import { Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import type { RecordMetadata } from 'kafkajs';
import { lastValueFrom } from 'rxjs';
import { KAFKA_CLIENT } from '@/core/kafka/kafka.constants';
import { EVENT_ID_HEADER } from '@/core/outbox/outbox.constants';
import { isTransientKafkaError } from '@/core/outbox/outbox.backoff';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';

// Thin Kafka producer used only by the outbox relay; the HTTP path never publishes
@Injectable()
export class OutboxPublisher {
  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: ClientKafka) {}

  // Resolves once the broker acks; rejects with the kafkajs error otherwise
  async publish(event: OutboxEvent): Promise<RecordMetadata | undefined> {
    try {
      // key = userId → all events of one user go to the same partition, in order
      const records = await lastValueFrom(
        this.kafka.emit<RecordMetadata[] | undefined>(event.topic, {
          key: event.messageKey,
          value: event.payload,
          headers: { [EVENT_ID_HEADER]: event.id },
        }),
      );
      return records?.[0];
    } catch (error) {
      // ClientKafka caches its first connect() promise, even a rejected one. Reset it so
      // the next attempt reconnects once the broker is back.
      if (isTransientKafkaError(error)) {
        await this.kafka.close().catch(() => undefined);
      }
      throw error;
    }
  }
}
