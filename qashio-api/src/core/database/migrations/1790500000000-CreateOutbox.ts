import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutbox1790500000000 implements MigrationInterface {
  name = 'CreateOutbox1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // No FK on aggregate_id: the outbox is a historical log and outlives the row it describes
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL,
        "aggregate_type" varchar(50) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "topic" varchar(100) NOT NULL,
        "message_key" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "sent_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_outbox_events" PRIMARY KEY ("id")
      )
    `);
    // The relay's poll: only PENDING rows, so the index stays small as SENT rows pile up
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_pending" ON "outbox_events" ("next_attempt_at", "created_at")
      WHERE "status" = 'PENDING'
    `);
    // Per-key ordering check in the relay: "is there an earlier PENDING row for this key?"
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_pending_key" ON "outbox_events" ("message_key", "created_at")
      WHERE "status" = 'PENDING'
    `);
    // Health check's FAILED count, without scanning the whole table
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_failed" ON "outbox_events" ("created_at")
      WHERE "status" = 'FAILED'
    `);
    // Nightly cleanup of old SENT rows
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_sent_at" ON "outbox_events" ("sent_at")
      WHERE "status" = 'SENT'
    `);

    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "event_id" uuid NOT NULL,
        "consumer" varchar(100) NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_processed_events" PRIMARY KEY ("event_id", "consumer")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_processed_events_processed_at" ON "processed_events" ("processed_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "processed_events"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}
