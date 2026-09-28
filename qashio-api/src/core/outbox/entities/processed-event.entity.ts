import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
@Index('idx_processed_events_processed_at', ['processedAt'])
export class ProcessedEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  consumer!: string;

  @Column({
    name: 'processed_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  processedAt!: Date;
}
