export interface Transaction {
  id: string;
  date: string;
  reference: string;
  counterparty: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  // Category name for display; categoryId is what the API filters and saves by.
  category: string;
  categoryId?: string;
  type: 'income' | 'expense';
  narration: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export type TransactionFormData = Omit<Transaction, 'id' | 'categoryId'>;

// Filter/sort/pagination state now lives in `TransactionFiltersState`
// (see app/hooks/useTransactionStore.ts), which stays in sync with the URL.

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginRequest extends LoginPayload {
  // Keep the session after the browser closes.
  rememberMe?: boolean;
}

export interface RegisterPayload extends LoginPayload {
  firstName: string;
  lastName: string;
}
