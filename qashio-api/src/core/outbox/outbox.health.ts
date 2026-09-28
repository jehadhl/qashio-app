import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';

interface PendingStats {
  pending: number;
  oldest_age_min: number | null;
}

// Read-only watchdog: only SELECTs, never changes a row. Both queries hit partial indexes.
@Injectable()
export class OutboxHealth {
  private readonly logger = new Logger(OutboxHealth.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(outboxConfig.KEY)
    private readonly config: ConfigType<typeof outboxConfig>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async check(): Promise<void> {
    try {
      const [{ failed }] = await this.dataSource.query<{ failed: number }[]>(
        `SELECT count(*)::int AS "failed" FROM "outbox_events" WHERE "status" = $1`,
        [OutboxStatus.FAILED],
      );
      const [{ pending, oldest_age_min }] = await this.dataSource.query<
        PendingStats[]
      >(
        `SELECT count(*)::int AS "pending",
                EXTRACT(EPOCH FROM now() - min("created_at")) / 60 AS "oldest_age_min"
         FROM "outbox_events"
         WHERE "status" = $1`,
        [OutboxStatus.PENDING],
      );

      let healthy = true;
      if (failed > 0) {
        healthy = false;
        this.logger.warn(
          `⚠ ${failed} outbox event(s) in FAILED state need attention`,
        );
      }

      const oldestMin = oldest_age_min === null ? 0 : Number(oldest_age_min);
      if (oldestMin > this.config.stuckThresholdMin) {
        healthy = false;
        this.logger.warn(
          `⚠ oldest PENDING event is ${Math.floor(oldestMin)} min old — is Kafka down? (${pending} PENDING)`,
        );
      }

      if (healthy) {
        this.logger.debug(`✓ outbox healthy (${pending} PENDING)`);
      }
    } catch (error) {
      this.logger.error(
        '✗ outbox health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
