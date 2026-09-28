import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';

export const CLEANUP_BATCH_SIZE = 1000;

// Only SENT rows: PENDING and FAILED are never deleted, whatever their age
const DELETE_SENT_SQL = `
  WITH deleted AS (
    DELETE FROM "outbox_events"
    WHERE "id" IN (
      SELECT "id" FROM "outbox_events"
      WHERE "status" = '${OutboxStatus.SENT}'
        AND "sent_at" < now() - make_interval(days => $1)
      LIMIT $2
    )
    RETURNING 1
  )
  SELECT count(*)::int AS "count" FROM deleted
`;

// processed_events retention must be >= the Kafka topic retention. Otherwise a message
// replayed from Kafka (consumer reset, redelivery) after its row is gone would be
// processed twice.
const DELETE_PROCESSED_SQL = `
  WITH deleted AS (
    DELETE FROM "processed_events"
    WHERE ("event_id", "consumer") IN (
      SELECT "event_id", "consumer" FROM "processed_events"
      WHERE "processed_at" < now() - make_interval(days => $1)
      LIMIT $2
    )
    RETURNING 1
  )
  SELECT count(*)::int AS "count" FROM deleted
`;

@Injectable()
export class OutboxCleanup {
  private readonly logger = new Logger(OutboxCleanup.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(outboxConfig.KEY)
    private readonly config: ConfigType<typeof outboxConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    try {
      const sent = await this.deleteInBatches(DELETE_SENT_SQL);
      const processed = await this.deleteInBatches(DELETE_PROCESSED_SQL);
      this.logger.log(
        `✓ cleanup: removed ${sent} sent, ${processed} processed`,
      );
    } catch (error) {
      this.logger.error(
        '✗ outbox cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Small batches keep each DELETE short, so it never holds locks for long
  private async deleteInBatches(sql: string): Promise<number> {
    let total = 0;
    let deleted: number;
    do {
      const [{ count }] = await this.dataSource.query<{ count: number }[]>(
        sql,
        [this.config.retentionDays, CLEANUP_BATCH_SIZE],
      );
      deleted = count;
      total += deleted;
    } while (deleted === CLEANUP_BATCH_SIZE);
    return total;
  }
}
