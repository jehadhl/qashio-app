import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';

export interface TransactionEventPayload {
  // = outbox row id; consumers dedupe on it
  eventId: string;
  transactionId: string;
  userId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  date: string;
  occurredAt: string;
}
