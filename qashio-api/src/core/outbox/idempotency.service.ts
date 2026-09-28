import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class IdempotencyService {
  // true = first time this consumer sees the event. Run it inside the same transaction as
  // the handler's work: if the handler fails, the mark rolls back and redelivery retries.
  async markProcessed(
    manager: EntityManager,
    eventId: string,
    consumer: string,
  ): Promise<boolean> {
    const rows = await manager.query<{ event_id: string }[]>(
      `INSERT INTO "processed_events" ("event_id", "consumer")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING "event_id"`,
      [eventId, consumer],
    );
    return rows.length > 0;
  }
}
