import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { KafkaContext } from '@nestjs/microservices';
import { DataSource, EntityManager } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';
import { BudgetEventsConsumer } from '@/modules/budgets/consumers/budget-events.consumer';

// unit test for consumer
describe('BudgetEventsConsumer', () => {
  const budgetsService = { checkUsageForCategory: jest.fn() };
  const idempotency = { markProcessed: jest.fn() };
  const manager = {} as EntityManager;
  // Mirrors TypeORM: the callback's rejection is what transaction() rejects with
  const dataSource = {
    transaction: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const config = { consumerMaxRetries: 2 } as ConfigType<typeof outboxConfig>;
  let consumer: BudgetEventsConsumer;

  const context = {
    getTopic: () => 'transaction.created',
    getPartition: () => 0,
    getMessage: () => ({ offset: '17' }),
  } as unknown as KafkaContext;

  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();

  const event: TransactionEventPayload = {
    eventId: '0b8f5c1e-4d2a-4f4b-9a57-6c7f0f6b2a11',
    transactionId: 'tx-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    amount: 100,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    date: '2026-09-26T10:00:00.000Z',
    occurredAt: '2026-09-26T10:00:01.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new BudgetEventsConsumer(
      budgetsService as unknown as BudgetsService,
      idempotency,
      dataSource as unknown as DataSource,
      config,
    );
    budgetsService.checkUsageForCategory.mockResolvedValue([]);
    idempotency.markProcessed.mockResolvedValue(true);
  });

  it('marks the event processed under the budget consumer, in the transaction', async () => {
    await consumer.onTransactionCreated(event, context);
    expect(idempotency.markProcessed).toHaveBeenCalledWith(
      manager,
      event.eventId,
      'budget-consumer',
    );
  });

  it('skips a duplicate event without checking budgets', async () => {
    idempotency.markProcessed.mockResolvedValue(false);

    await consumer.onTransactionCreated(event, context);

    expect(budgetsService.checkUsageForCategory).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('↷'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('duplicate'));
  });

  it('skips income transactions but still marks them processed', async () => {
    await consumer.onTransactionCreated(
      { ...event, type: TransactionType.INCOME },
      context,
    );
    expect(idempotency.markProcessed).toHaveBeenCalled();
    expect(budgetsService.checkUsageForCategory).not.toHaveBeenCalled();
  });

  it('ignores pending transactions', async () => {
    await consumer.onTransactionCreated(
      { ...event, status: TransactionStatus.PENDING },
      context,
    );
    expect(budgetsService.checkUsageForCategory).not.toHaveBeenCalled();
  });

  it('checks budgets for the transaction category', async () => {
    await consumer.onTransactionCreated(event, context);
    expect(budgetsService.checkUsageForCategory).toHaveBeenCalledWith(
      'user-1',
      'cat-1',
    );
  });

  it('warns when a budget is exceeded, including the message position', async () => {
    budgetsService.checkUsageForCategory.mockResolvedValue([
      {
        budget: { id: 'b-1', amount: 500, period: 'monthly' },
        usage: {
          spent: 520,
          remaining: -20,
          percentage: 104,
          isExceeded: true,
        },
      },
    ]);

    await consumer.onTransactionCreated(event, context);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('exceeded'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('offset 17'));
  });

  it('warns when a budget is above 80%', async () => {
    budgetsService.checkUsageForCategory.mockResolvedValue([
      {
        budget: { id: 'b-1', amount: 500, period: 'monthly' },
        usage: { spent: 450, remaining: 50, percentage: 90, isExceeded: false },
      },
    ]);

    await consumer.onTransactionCreated(event, context);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('approaching limit'),
    );
  });

  it('rethrows a processing error so Kafka redelivers the message', async () => {
    budgetsService.checkUsageForCategory.mockRejectedValue(
      new Error('db down'),
    );

    await expect(consumer.onTransactionCreated(event, context)).rejects.toThrow(
      'db down',
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('will be redelivered'),
      expect.any(String),
    );
  });

  it('gives up on a poison message after the max retries, without rethrowing', async () => {
    budgetsService.checkUsageForCategory.mockRejectedValue(
      new Error('db down'),
    );

    // consumerMaxRetries = 2 → processed 3 times (delivery + 2 retries);
    // the first two failures are rethrown, the third gives up
    for (let i = 0; i < 2; i++) {
      await expect(
        consumer.onTransactionCreated(event, context),
      ).rejects.toThrow('db down');
    }
    await expect(
      consumer.onTransactionCreated(event, context),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenLastCalledWith(
      expect.stringContaining(JSON.stringify(event)),
      expect.any(String),
    );
  });

  it('resets the retry counter once the message succeeds', async () => {
    budgetsService.checkUsageForCategory
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce([])
      .mockRejectedValue(new Error('blip'));

    await expect(
      consumer.onTransactionCreated(event, context),
    ).rejects.toThrow();
    await expect(
      consumer.onTransactionCreated(event, context),
    ).rejects.toThrow();
    await consumer.onTransactionCreated(event, context);
    // Counter was cleared, so this failure is attempt 1 again, not a give-up
    await expect(
      consumer.onTransactionCreated(event, context),
    ).rejects.toThrow();
  });

  it('ignores a message without an eventId instead of blocking the partition', async () => {
    const malformed = null as unknown as TransactionEventPayload;

    await expect(
      consumer.onTransactionCreated(malformed, context),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no eventId'));
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
