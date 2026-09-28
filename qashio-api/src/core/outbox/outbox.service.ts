import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';

export interface OutboxEventInput {
  id?: string;
  aggregateType: string;
  aggregateId: string;
  topic: string;
  messageKey: string;
  payload: object;
}

@Injectable()
export class OutboxService {
  // Always writes through the caller's manager, so the event commits (or rolls back)
  // together with the business change it describes.
  async add(manager: EntityManager, input: OutboxEventInput): Promise<string> {
    const id = input.id ?? randomUUID();
    await manager.insert(OutboxEvent, {
      id,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      topic: input.topic,
      messageKey: input.messageKey,
      payload: { ...input.payload },
    });
    return id;
  }
}
