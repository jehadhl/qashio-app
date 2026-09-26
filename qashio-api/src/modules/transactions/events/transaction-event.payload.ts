import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';

export interface TransactionEventPayload {
  transactionId: string;
  userId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  date: string;  
  occurredAt: string; 
}