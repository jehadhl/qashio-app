import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import type { RecordMetadata } from 'kafkajs';
import { lastValueFrom } from 'rxjs';
import { KAFKA_CLIENT, KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionEventPayload } from './transaction-event.payload';

type TransactionTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

@Injectable()
export class TransactionEventsPublisher {
  private readonly logger = new Logger(TransactionEventsPublisher.name);

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: ClientKafka) {}

  publishCreated(transaction: Transaction): Promise<void> {
    return this.publish(KAFKA_TOPICS.TRANSACTION_CREATED, transaction);
  }

  publishUpdated(transaction: Transaction): Promise<void> {
    return this.publish(KAFKA_TOPICS.TRANSACTION_UPDATED, transaction);
  }

  private async publish(
    topic: TransactionTopic,
    transaction: Transaction,
  ): Promise<void> {
    const payload: TransactionEventPayload = {
      transactionId: transaction.id,
      userId: transaction.userId,
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      date: transaction.date.toISOString(),
      occurredAt: new Date().toISOString(),
    };

    const summary = `tx=${transaction.id} user=${transaction.userId} ${payload.type} ${payload.amount} ${payload.status}`;
    const startedAt = Date.now();

    try {
      // key = userId → all events of one user go to the same partition, in order
      const records = await lastValueFrom(
        this.kafka.emit<RecordMetadata[] | undefined>(topic, {
          key: transaction.userId,
          value: payload,
        }),
      );
      const record = records?.[0];
      this.logger.log(
        `→ ${topic} [partition ${record?.partition ?? '?'} @ offset ${record?.baseOffset ?? '?'}] ${summary} (${Date.now() - startedAt}ms)`,
      );
    } catch (error) {
      // The transaction is already saved; a broker outage must not fail the HTTP request
      this.logger.error(
        `✗ ${topic} publish failed: ${summary}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
