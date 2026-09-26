import { Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';
import { BudgetEventsConsumer } from '@/modules/budgets/consumers/budget-events.consumer';

// unit test for consumer 
describe('BudgetEventsConsumer', () => {
  const budgetsService = { checkUsageForCategory: jest.fn() };
  const consumer = new BudgetEventsConsumer(budgetsService as unknown as BudgetsService);

  const context = {
    getTopic: () => 'transaction.created',
    getPartition: () => 0,
    getMessage: () => ({ offset: '17' }),
  } as unknown as KafkaContext;

  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();

  const event: TransactionEventPayload = {
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
    budgetsService.checkUsageForCategory.mockResolvedValue([]);
  });

  it('ignores income transactions', async () => {
    await consumer.onTransactionCreated({ ...event, type: TransactionType.INCOME }, context);
    expect(budgetsService.checkUsageForCategory).not.toHaveBeenCalled();
  });

  it('ignores pending transactions', async () => {
    await consumer.onTransactionCreated({ ...event, status: TransactionStatus.PENDING }, context);
    expect(budgetsService.checkUsageForCategory).not.toHaveBeenCalled();
  });

  it('checks budgets for the transaction category', async () => {
    await consumer.onTransactionCreated(event, context);
    expect(budgetsService.checkUsageForCategory).toHaveBeenCalledWith('user-1', 'cat-1');
  });

  it('warns when a budget is exceeded, including the message position', async () => {
    budgetsService.checkUsageForCategory.mockResolvedValue([
      {
        budget: { id: 'b-1', amount: 500, period: 'monthly' },
        usage: { spent: 520, remaining: -20, percentage: 104, isExceeded: true },
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

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('approaching limit'));
  });

  it('does not throw when the budget check fails', async () => {
    budgetsService.checkUsageForCategory.mockRejectedValue(new Error('db down'));

    await expect(consumer.onTransactionCreated(event, context)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it('does not throw on a malformed message', async () => {
    const malformed = null as unknown as TransactionEventPayload;

    await expect(consumer.onTransactionCreated(malformed, context)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});