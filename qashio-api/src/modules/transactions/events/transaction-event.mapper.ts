import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';

export const toTransactionEventPayload = (
  transaction: Transaction,
  eventId: string,
): TransactionEventPayload => ({
  eventId,
  transactionId: transaction.id,
  userId: transaction.userId,
  categoryId: transaction.categoryId,
  amount: transaction.amount,
  type: transaction.type,
  status: transaction.status,
  date: transaction.date.toISOString(),
  occurredAt: new Date().toISOString(),
});
