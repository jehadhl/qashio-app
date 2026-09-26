'use client';

import { create } from 'zustand';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export type DatePreset = '' | 'today' | 'week' | 'month';
export type StatusFilter = '' | 'Completed' | 'Pending' | 'Failed';
export type TypeFilter = '' | 'income' | 'expense';
export type SortBy = 'date' | 'amount';
export type SortOrder = 'asc' | 'desc';

export interface TransactionFiltersState {
  searchTerm: string;
  datePreset: DatePreset;
  status: StatusFilter;
  type: TypeFilter;
  category: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

export const DEFAULT_FILTERS: TransactionFiltersState = {
  searchTerm: '',
  datePreset: '',
  status: '',
  type: '',
  category: '',
  sortBy: 'date',
  sortOrder: 'desc',
  page: 1,
  limit: 10,
};

// True when the user has narrowed or re-sorted the list (page and page size don't count).
export const hasActiveFilters = (filters: TransactionFiltersState) =>
  filters.searchTerm !== DEFAULT_FILTERS.searchTerm ||
  filters.datePreset !== DEFAULT_FILTERS.datePreset ||
  filters.status !== DEFAULT_FILTERS.status ||
  filters.type !== DEFAULT_FILTERS.type ||
  filters.category !== DEFAULT_FILTERS.category ||
  filters.sortBy !== DEFAULT_FILTERS.sortBy ||
  filters.sortOrder !== DEFAULT_FILTERS.sortOrder;

interface TransactionStoreState {
  filters: TransactionFiltersState;
  // False until filters have been read from the URL, so the page doesn't fetch
  // the default list first and then refetch with the real filters.
  hydrated: boolean;
  setFilters: (patch: Partial<TransactionFiltersState>) => void;
  setPage: (page: number) => void;
  toggleSort: (field: SortBy) => void;
  resetFilters: () => void;
}

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  filters: DEFAULT_FILTERS,
  hydrated: false,

  setFilters: (patch) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...patch,
        page: patch.page !== undefined ? patch.page : 1,
      },
    })),

  setPage: (page) =>
    set((state) => ({
      filters: { ...state.filters, page },
    })),

  toggleSort: (field) => {
    const { sortBy, sortOrder } = get().filters;
    const nextOrder: SortOrder =
      sortBy === field ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
    get().setFilters({ sortBy: field, sortOrder: nextOrder });
  },

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));

const isDatePreset = (value: string | null): value is DatePreset =>
  value === 'today' || value === 'week' || value === 'month';

const isStatusFilter = (value: string | null): value is StatusFilter =>
  value === 'Completed' || value === 'Pending' || value === 'Failed';

const isTypeFilter = (value: string | null): value is TypeFilter =>
  value === 'income' || value === 'expense';

function filtersFromSearchParams(params: URLSearchParams): TransactionFiltersState {
  const status = params.get('status');
  const type = params.get('type');
  const datePreset = params.get('date');
  const sortBy = params.get('sortBy');
  const sortOrder = params.get('sortOrder');
  const page = Number(params.get('page'));
  const limit = Number(params.get('limit'));

  return {
    searchTerm: params.get('searchTerm') ?? DEFAULT_FILTERS.searchTerm,
    datePreset: isDatePreset(datePreset) ? datePreset : DEFAULT_FILTERS.datePreset,
    status: isStatusFilter(status) ? status : DEFAULT_FILTERS.status,
    type: isTypeFilter(type) ? type : DEFAULT_FILTERS.type,
    category: params.get('category') ?? DEFAULT_FILTERS.category,
    sortBy: sortBy === 'amount' ? 'amount' : DEFAULT_FILTERS.sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : DEFAULT_FILTERS.sortOrder,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_FILTERS.page,
    limit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_FILTERS.limit,
  };
}

function searchParamsFromFilters(filters: TransactionFiltersState): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.searchTerm) params.set('searchTerm', filters.searchTerm);
  if (filters.datePreset) params.set('date', filters.datePreset);
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.category) params.set('category', filters.category);
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page !== DEFAULT_FILTERS.page) params.set('page', String(filters.page));
  if (filters.limit !== DEFAULT_FILTERS.limit) params.set('limit', String(filters.limit));

  return params;
}


export function useTransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useTransactionStore((state) => state.filters);
  const setFilters = useTransactionStore((state) => state.setFilters);
  const setPage = useTransactionStore((state) => state.setPage);
  const toggleSort = useTransactionStore((state) => state.toggleSort);
  const resetFilters = useTransactionStore((state) => state.resetFilters);
  const hydrated = useTransactionStore((state) => state.hydrated);

  const skipNextPush = useRef(true);


  useEffect(() => {
    useTransactionStore.setState({ filters: filtersFromSearchParams(searchParams), hydrated: true });

  }, []);


  useEffect(() => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const query = searchParamsFromFilters(filters).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters]);

  return { filters, hydrated, setFilters, setPage, toggleSort, resetFilters };
}
