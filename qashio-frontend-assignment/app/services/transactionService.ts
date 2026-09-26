// lib/services/transactionService.ts
'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Category, Transaction, TransactionFormData } from '@/app/types';
import { DatePreset, TransactionFiltersState } from '@/app/hooks/useTransactionStore';
import { unwrapEnvelope } from '@/app/services/apiClient';
import { categoriesQueryKey } from '@/app/services/categoryService';

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TransactionsApiResponse {
  data: Transaction[];
  pagination: PaginationInfo;
}

const EMPTY_RESPONSE = (page: number, limit: number): TransactionsApiResponse => ({
  data: [],
  pagination: { total: 0, page, limit, totalPages: 0 },
});

// Translate a friendly date preset ("today" / "week" / "month") into the ISO
// startDate/endDate range the API actually understands.
const getDateRangeForPreset = (preset: DatePreset): { startDate?: string; endDate?: string } => {
  if (!preset) return {};

  const now = new Date();
  const endDate = endOfDay(now).toISOString();

  switch (preset) {
    case 'today':
      return { startDate: startOfDay(now).toISOString(), endDate };
    case 'week':
      return { startDate: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), endDate };
    case 'month':
      return { startDate: startOfMonth(now).toISOString(), endDate };
    default:
      return {};
  }
};

const buildQueryParams = (filters: TransactionFiltersState): URLSearchParams => {
  const params = new URLSearchParams();
  const { startDate, endDate } = getDateRangeForPreset(filters.datePreset);

  // NestJS contract: `search`, lowercase status, and the category's id.
  if (filters.searchTerm) params.set('search', filters.searchTerm);
  if (filters.status) params.set('status', filters.status.toLowerCase());
  if (filters.type) params.set('type', filters.type);
  if (filters.category) params.set('categoryId', filters.category);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  params.set('sortBy', filters.sortBy);
  params.set('sortOrder', filters.sortOrder);
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));

  return params;
};

// NestJS returns `category` as { id, name } and lowercase statuses; the mock returns
// the category name and capitalised statuses. The UI works with one shape.
type ApiTransaction = Omit<Transaction, 'category' | 'status' | 'type'> & {
  category: string | { id: string; name: string } | null;
  categoryId?: string;
  status: string;
  type?: Transaction['type'];
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

export const normalizeTransaction = (raw: ApiTransaction): Transaction => {
  const category = raw.category && typeof raw.category === 'object' ? raw.category : null;
  return {
    ...raw,
    category: category ? category.name : ((raw.category as string | null) ?? ''),
    categoryId: category?.id ?? raw.categoryId,
    status: capitalize(raw.status) as Transaction['status'],
    type: raw.type ?? 'expense',
    reference: raw.reference ?? '',
    narration: raw.narration ?? '',
    amount: Number(raw.amount),
  };
};

const fetchTransactions = async (
  filters: TransactionFiltersState,
  signal?: AbortSignal
): Promise<TransactionsApiResponse> => {
  const params = buildQueryParams(filters);

  const response = await fetch(`/api/transactions?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    // Lets React Query abort this request (via its own AbortController) if the
    // filters change again - or the component unmounts - before it resolves,
    // so a fast typist/filterer never gets a stale response race.
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.data)) {
    return EMPTY_RESPONSE(filters.page, filters.limit);
  }

  return { data: data.data.map(normalizeTransaction), pagination: data.pagination };
};

export const useTransactions = (filters: TransactionFiltersState, enabled = true) => {
  return useQuery({
    enabled,
    queryKey: ['transactions', filters],
    queryFn: ({ signal }) => fetchTransactions(filters, signal),
    placeholderData: keepPreviousData,
    retry: 1,
  });
};

export interface ApiFieldError {
  field: string;
  message: string;
}

// Carries the API's structured error (incl. per-field validation details) so the
// UI can pin server-side messages to the matching inputs, or show a 404 state.
export class TransactionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: ApiFieldError[] = []
  ) {
    super(message);
    this.name = 'TransactionApiError';
  }
}

// NestJS validation errors: [{ field: 'categoryId', messages: [...] }] -> form field errors.
const fromNestFieldErrors = (errors: unknown): ApiFieldError[] =>
  Array.isArray(errors)
    ? errors.map((e: { field: string; messages?: string[] }) => ({
        field: e.field === 'categoryId' ? 'category' : e.field,
        message: e.messages?.[0] ?? 'Invalid value',
      }))
    : [];

export const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new TransactionApiError(
      body?.error?.message ?? `API error: ${response.status}`,
      response.status,
      body?.error?.details ?? fromNestFieldErrors(body?.errors)
    );
  }

  return unwrapEnvelope(body) as T;
};

// Form data (category name, capitalised status) -> NestJS body (categoryId, lowercase status).
// The category id comes from the categories list the form has already loaded.
const toApiPayload = (
  data: Partial<TransactionFormData>,
  categories: Category[] | undefined
): Record<string, unknown> => {
  const { category, status, ...rest } = data;
  const payload: Record<string, unknown> = { ...rest };

  if (status) payload.status = status.toLowerCase();
  if (category !== undefined) {
    const match = categories?.find((c) => c.name.toLowerCase() === category.trim().toLowerCase());
    if (!match) {
      throw new TransactionApiError('Please pick a category from the list', 400, [
        { field: 'category', message: 'Please pick a category from the list' },
      ]);
    }
    payload.categoryId = match.id;
  }
  return payload;
};

const transactionUrl = (id: string) => `/api/transactions/${encodeURIComponent(id)}`;

export const transactionQueryKey = (id: string) => ['transaction', id] as const;

export const useTransaction = (id: string | null) => {
  return useQuery({
    queryKey: transactionQueryKey(id ?? ''),
    queryFn: async ({ signal }) =>
      normalizeTransaction(await request<ApiTransaction>(transactionUrl(id!), { signal })),
    enabled: !!id,
    // A missing transaction won't appear on retry.
    retry: (failureCount, error) =>
      !(error instanceof TransactionApiError && error.status === 404) && failureCount < 1,
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransactionFormData) =>
      normalizeTransaction(
        await request<ApiTransaction>('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(
            toApiPayload(payload, queryClient.getQueryData<Category[]>(categoriesQueryKey))
          ),
        })
      ),
    // Every cached list page may now be out of date, so refetch them all.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // PUT, matching the NestJS API: the whole transaction is replaced, so every field is sent.
    mutationFn: async ({ id, data }: { id: string; data: TransactionFormData }) =>
      normalizeTransaction(
        await request<ApiTransaction>(transactionUrl(id), {
          method: 'PUT',
          body: JSON.stringify(
            toApiPayload(data, queryClient.getQueryData<Category[]>(categoriesQueryKey))
          ),
        })
      ),
    onSuccess: (transaction) => {
      queryClient.setQueryData(transactionQueryKey(transaction.id), transaction);
      return queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true; id: string }>(transactionUrl(id), { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: transactionQueryKey(id) });
      return queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
