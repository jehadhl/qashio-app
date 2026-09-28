import { Controller, Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import outboxConfig from '@/core/outbox/outbox.config';
import { OUTBOX_CONSUMERS } from '@/core/outbox/outbox.constants';
import { IdempotencyService } from '@/core/outbox/idempotency.service';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';

const WARNING_THRESHOLD = 80;

@Controller()
export class BudgetEventsConsumer {
  private readonly logger = new Logger(BudgetEventsConsumer.name);

  // Failures per message position (topic:partition:offset), for the poison-message guard.
  // In-memory only: a restart gives a poison message a fresh set of retries.
  private readonly failures = new Map<string, number>();

  constructor(
    private readonly budgetsService: BudgetsService,
    private readonly idempotency: IdempotencyService,
    private readonly dataSource: DataSource,
    @Inject(outboxConfig.KEY)
    private readonly config: ConfigType<typeof outboxConfig>,
  ) {}

  @EventPattern(KAFKA_TOPICS.TRANSACTION_CREATED)
  onTransactionCreated(
    @Payload() event: TransactionEventPayload,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    return this.handle(event, context);
  }

  @EventPattern(KAFKA_TOPICS.TRANSACTION_UPDATED)
  onTransactionUpdated(
    @Payload() event: TransactionEventPayload,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    return this.handle(event, context);
  }

  // Delivery is at-least-once; processed_events makes the effect exactly-once. A thrown
  // error leaves the offset uncommitted, so Kafka redelivers the message.
  private async handle(
    event: TransactionEventPayload,
    context: KafkaContext,
  ): Promise<void> {
    const offset = context.getMessage().offset;
    const where = `${context.getTopic()} [partition ${context.getPartition()} @ offset ${offset}]`;
    const position = `${context.getTopic()}:${context.getPartition()}:${offset}`;

    if (!event?.eventId) {
      // Can't dedupe it, and blocking the partition over it would stall every later event
      this.logger.warn(`⚠ ${where} message has no eventId, ignoring`);
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const firstTime = await this.idempotency.markProcessed(
          manager,
          event.eventId,
          OUTBOX_CONSUMERS.BUDGET,
        );
        if (!firstTime) {
          this.logger.log(`↷ ${where} duplicate eventId=${event.eventId}`);
          return;
        }
        await this.checkBudgets(event, where);
      });
      this.failures.delete(position);
    } catch (error) {
      const failures = (this.failures.get(position) ?? 0) + 1;
      const stack = error instanceof Error ? error.stack : String(error);

      if (failures > this.config.consumerMaxRetries) {
        // Poison message: give up so the partition moves on (offset gets committed)
        this.failures.delete(position);
        this.logger.error(
          `✗ ${where} giving up on eventId=${event.eventId} after ${failures} attempts, payload=${JSON.stringify(event)}`,
          stack,
        );
        return;
      }

      this.failures.set(position, failures);
      this.logger.error(
        `✗ ${where} failed to process eventId=${event.eventId} (attempt ${failures}), will be redelivered`,
        stack,
      );
      throw error;
    }
  }

  private async checkBudgets(
    event: TransactionEventPayload,
    where: string,
  ): Promise<void> {
    const startedAt = Date.now();
    const summary = `tx=${event.transactionId} user=${event.userId}`;
    const lagMs = Date.now() - new Date(event.occurredAt).getTime();

    this.logger.debug(
      `← ${where} ${summary} ${event.type} ${event.amount} ${event.status} eventId=${event.eventId} (lag ${lagMs}ms)`,
    );

    if (
      event.type !== TransactionType.EXPENSE ||
      event.status !== TransactionStatus.COMPLETED
    ) {
      this.logger.debug(
        `↷ ${where} skipped: only completed expenses count towards budgets`,
      );
      return;
    }

    const results = await this.budgetsService.checkUsageForCategory(
      event.userId,
      event.categoryId,
    );

    for (const { budget, usage } of results) {
      const usageText = `${usage.spent}/${budget.amount} (${usage.percentage}%, ${budget.period})`;

      if (usage.isExceeded) {
        this.logger.warn(
          `${where} budget ${budget.id} exceeded for user ${event.userId}: ${usageText}`,
        );
      } else if (usage.percentage >= WARNING_THRESHOLD) {
        this.logger.warn(
          `${where} budget ${budget.id} approaching limit for user ${event.userId}: ${usageText}`,
        );
      } else {
        this.logger.debug(
          `${where} budget ${budget.id} within limit: ${usageText}`,
        );
      }
    }

    this.logger.debug(
      `✓ ${where} checked ${results.length} budget(s) (${Date.now() - startedAt}ms)`,
    );
  }
}
