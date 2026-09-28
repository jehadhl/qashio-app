import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource, EntityManager, In } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import {
  computeBackoffMs,
  isTransientKafkaError,
} from '@/core/outbox/outbox.backoff';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';
import { OutboxPublisher } from '@/core/outbox/outbox.publisher';

const RELAY_INTERVAL_NAME = 'outbox-relay';
const MAX_ERROR_LENGTH = 2000;

// Rows are claimed with FOR UPDATE SKIP LOCKED, so several relays (instances) never
// publish the same row. A row whose same-key predecessor is still PENDING but waiting
// for its backoff is not eligible, so one user's events are never sent out of order.
const CLAIM_BATCH_SQL = `
  SELECT *
  FROM "outbox_events" o
  WHERE o."status" = '${OutboxStatus.PENDING}'
    AND o."next_attempt_at" <= now()
    AND NOT EXISTS (
      SELECT 1
      FROM "outbox_events" earlier
      WHERE earlier."status" = '${OutboxStatus.PENDING}'
        AND earlier."message_key" = o."message_key"
        AND earlier."created_at" < o."created_at"
        AND earlier."next_attempt_at" > now()
    )
  ORDER BY o."created_at"
  LIMIT $1
  FOR UPDATE OF o SKIP LOCKED
`;

interface OutboxEventRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  topic: string;
  message_key: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  next_attempt_at: Date;
  created_at: Date;
  sent_at: Date | null;
}

interface BatchResult {
  claimed: number;
  kafkaDown: boolean;
}

const toEntity = (row: OutboxEventRow): OutboxEvent =>
  Object.assign(new OutboxEvent(), {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    topic: row.topic,
    messageKey: row.message_key,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  });

const describeError = (error: unknown): string => {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
};

// Database clock, so the relay's `next_attempt_at <= now()` never races the app's clock
const nowPlus = (delayMs: number) => () =>
  `now() + interval '${Math.round(delayMs)} milliseconds'`;

@Injectable()
export class OutboxRelay
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: OutboxPublisher,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(outboxConfig.KEY)
    private readonly config: ConfigType<typeof outboxConfig>,
  ) {}

  // Registered here rather than with @Interval so the period comes from config
  onApplicationBootstrap(): void {
    const handle = setInterval(
      () => void this.tick(),
      this.config.relayIntervalMs,
    );
    this.schedulerRegistry.addInterval(RELAY_INTERVAL_NAME, handle);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist('interval', RELAY_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(RELAY_INTERVAL_NAME);
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug('↷ previous tick still running, skipping');
      return;
    }
    this.running = true;

    try {
      // A full batch means there may be more: keep going so a backlog drains quickly
      // after an outage, unless Kafka is down (then everything just waits for backoff).
      let result: BatchResult;
      do {
        result = await this.processBatch();
      } while (result.claimed === this.config.batchSize && !result.kafkaDown);
    } catch (error) {
      // e.g. the database is unreachable; the next tick tries again
      this.logger.error(
        '✗ outbox relay tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private processBatch(): Promise<BatchResult> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<OutboxEventRow[]>(CLAIM_BATCH_SQL, [
        this.config.batchSize,
      ]);
      const events = rows.map(toEntity);
      const blockedKeys = new Set<string>();

      for (const [index, event] of events.entries()) {
        // An earlier event for this key failed in this batch: keep the order, wait
        if (blockedKeys.has(event.messageKey)) {
          continue;
        }

        try {
          const record = await this.publisher.publish(event);
          await manager.update(OutboxEvent, event.id, {
            status: OutboxStatus.SENT,
            sentAt: () => 'now()',
          });
          this.logger.log(
            `→ ${event.topic} [partition ${record?.partition ?? '?'} @ offset ${record?.baseOffset ?? '?'}] eventId=${event.id} key=${event.messageKey}`,
          );
        } catch (error) {
          if (isTransientKafkaError(error)) {
            await this.deferUntilKafkaIsBack(
              manager,
              events.slice(index),
              error,
            );
            return { claimed: rows.length, kafkaDown: true };
          }
          blockedKeys.add(event.messageKey);
          await this.recordPermanentFailure(manager, event, error);
        }
      }

      return { claimed: rows.length, kafkaDown: false };
    });
  }

  // Kafka is unreachable: not the message's fault, so attempts stay untouched and the
  // event can never become FAILED. The rest of the batch would fail the same way.
  private async deferUntilKafkaIsBack(
    manager: EntityManager,
    events: OutboxEvent[],
    error: unknown,
  ): Promise<void> {
    await manager.update(
      OutboxEvent,
      { id: In(events.map((event) => event.id)) },
      {
        lastError: describeError(error),
        nextAttemptAt: nowPlus(this.config.backoffMaxMs),
      },
    );
    this.logger.warn(
      `⚠ Kafka unavailable (${describeError(error)}), deferred ${events.length} event(s) for ${this.config.backoffMaxMs}ms`,
    );
  }

  // The broker rejected this message: count it, back off exponentially, give up at max
  private async recordPermanentFailure(
    manager: EntityManager,
    event: OutboxEvent,
    error: unknown,
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const lastError = describeError(error);

    if (attempts >= this.config.maxAttempts) {
      await manager.update(OutboxEvent, event.id, {
        status: OutboxStatus.FAILED,
        attempts,
        lastError,
      });
      this.logger.error(
        `✗ ${event.topic} eventId=${event.id} FAILED after ${attempts} attempt(s): ${lastError}`,
      );
      return;
    }

    const delayMs = computeBackoffMs(
      attempts,
      this.config.backoffBaseMs,
      this.config.backoffMaxMs,
    );
    await manager.update(OutboxEvent, event.id, {
      attempts,
      lastError,
      nextAttemptAt: nowPlus(delayMs),
    });
    this.logger.warn(
      `✗ ${event.topic} eventId=${event.id} attempt ${attempts}/${this.config.maxAttempts} failed, retry in ${delayMs}ms: ${lastError}`,
    );
  }
}
