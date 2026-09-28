import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';

@Entity('outbox_events')
@Index('idx_outbox_events_pending', ['nextAttemptAt', 'createdAt'], {
  where: `"status" = 'PENDING'`,
})
@Index('idx_outbox_events_pending_key', ['messageKey', 'createdAt'], {
  where: `"status" = 'PENDING'`,
})
@Index('idx_outbox_events_failed', ['createdAt'], {
  where: `"status" = 'FAILED'`,
})
@Index('idx_outbox_events_sent_at', ['sentAt'], {
  where: `"status" = 'SENT'`,
})
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 50 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ type: 'varchar', length: 100 })
  topic!: string;

  @Column({ name: 'message_key', type: 'varchar', length: 100 })
  messageKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: OutboxStatus.PENDING })
  status!: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  nextAttemptAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
