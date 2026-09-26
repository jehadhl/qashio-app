import { Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventsPublisher } from '@/modules/transactions/events/transaction-events.publisher';

describe('TransactionEventsPublisher', () => {
  const NOW = new Date('2026-09-26T12:00:00.000Z');

  const kafka = { emit: jest.fn() };
  const sentMessage = () =>
    kafka.emit.mock.calls[0] as [string, { key: string; value: unknown }];
  const publisher = new TransactionEventsPublisher(
    kafka as unknown as ClientKafka,
  );
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation();

  const transaction = {
    id: 'tx-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    amount: 120.5,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    date: new Date('2026-09-20T09:00:00.000Z'),
    counterparty: 'Acme Corp',
    narration: 'Monthly bill',
  } as Transaction;

  beforeAll(() => {
    jest.useFakeTimers({ now: NOW }); // freeze time → occurredAt is predictable
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    kafka.emit.mockReturnValue(of(undefined)); // default: broker accepts the message
  });

  describe('publishCreated', () => {
    it('sends to the transaction.created topic', async () => {
      await publisher.publishCreated(transaction);

      expect(kafka.emit).toHaveBeenCalledTimes(1);
      expect(kafka.emit).toHaveBeenCalledWith(
        KAFKA_TOPICS.TRANSACTION_CREATED,
        expect.anything(),
      );
    });

    it('uses userId as the message key (keeps one user’s events in order)', async () => {
      await publisher.publishCreated(transaction);

      const [, message] = sentMessage();
      expect(message.key).toBe('user-1');
    });

    it('sends exactly the contract fields, with dates as ISO strings', async () => {
      await publisher.publishCreated(transaction);

      const [, message] = sentMessage();
      expect(message.value).toEqual({
        transactionId: 'tx-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        amount: 120.5,
        type: TransactionType.EXPENSE,
        status: TransactionStatus.COMPLETED,
        date: '2026-09-20T09:00:00.000Z',
        occurredAt: '2026-09-26T12:00:00.000Z',
      });
    });

    it('does not leak fields outside the contract', async () => {
      await publisher.publishCreated(transaction);

      const [, message] = sentMessage();
      expect(message.value).not.toHaveProperty('counterparty');
      expect(message.value).not.toHaveProperty('narration');
    });
  });

  describe('publishUpdated', () => {
    it('sends to the transaction.updated topic', async () => {
      await publisher.publishUpdated(transaction);

      expect(kafka.emit).toHaveBeenCalledWith(
        KAFKA_TOPICS.TRANSACTION_UPDATED,
        expect.anything(),
      );
    });
  });

  describe('when Kafka is unavailable', () => {
    it('does not throw if the broker rejects the message', async () => {
      kafka.emit.mockReturnValue(throwError(() => new Error('broker down')));

      await expect(
        publisher.publishCreated(transaction),
      ).resolves.toBeUndefined();
    });

    it('does not throw if emit fails synchronously', async () => {
      kafka.emit.mockImplementation(() => {
        throw new Error('client not connected');
      });

      await expect(
        publisher.publishCreated(transaction),
      ).resolves.toBeUndefined();
    });

    it('logs the failure with topic and transaction id', async () => {
      kafka.emit.mockReturnValue(throwError(() => new Error('broker down')));

      await publisher.publishCreated(transaction);

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          `${KAFKA_TOPICS.TRANSACTION_CREATED} publish failed: tx=tx-1`,
        ),
        expect.any(String),
      );
    });
  });
});
