// Income/expense type: shown in the table, filterable, and sent to the API as ?type=.
import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import TransactionTable from '../TransactionTable';
import TransactionFilters from '../TransactionFilters';
import { DEFAULT_FILTERS, hasActiveFilters, useTransactionStore } from '@/app/hooks/useTransactionStore';
import { useTransactions } from '@/app/services/transactionService';
import { Transaction } from '@/app/types';
import { createTestQueryClient, mockFetch, mockRouter, renderWithProviders } from '@/test/utils';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1',
  date: '2026-09-20T10:00:00.000Z',
  reference: 'INV-1',
  counterparty: 'Acme Corp',
  amount: 250,
  status: 'Completed',
  type: 'expense',
  category: 'Rent',
  categoryId: 'c1',
  narration: 'Office rent',
  ...overrides,
});

describe('Transaction type (income / expense)', () => {
  beforeEach(() => {
    useTransactionStore.setState({ filters: DEFAULT_FILTERS, hydrated: true });
    mockRouter();
  });

  describe('table', () => {
    it('shows a Type column with a badge per row', () => {
      mockFetch({});
      renderWithProviders(
        <TransactionTable
          data={[tx({ id: 'a', type: 'income', reference: 'SAL-1' }), tx({ id: 'b', type: 'expense', reference: 'INV-2' })]}
        />
      );

      expect(screen.getByText('Type')).toBeInTheDocument();
      const incomeRow = screen.getByRole('button', { name: 'View transaction SAL-1' });
      const expenseRow = screen.getByRole('button', { name: 'View transaction INV-2' });
      expect(within(incomeRow).getByText('Income')).toBeInTheDocument();
      expect(within(expenseRow).getByText('Expense')).toBeInTheDocument();
    });

    it('signs amounts by type: + for income, − for expense', () => {
      mockFetch({});
      renderWithProviders(
        <TransactionTable
          data={[
            tx({ id: 'a', type: 'income', reference: 'SAL-1', amount: 4000 }),
            tx({ id: 'b', type: 'expense', reference: 'INV-2', amount: 250.5 }),
          ]}
        />
      );

      expect(screen.getByText('+4,000.00 AED')).toBeInTheDocument();
      expect(screen.getByText('−250.50 AED')).toBeInTheDocument();
    });
  });

  describe('filter', () => {
    it('sets the type filter and goes back to page 1', async () => {
      const user = userEvent.setup();
      mockFetch({ 'GET /categories': { body: [] } });
      useTransactionStore.setState({ filters: { ...DEFAULT_FILTERS, page: 3 } });
      renderWithProviders(<TransactionFilters />);

      await user.click(screen.getByRole('combobox', { name: 'Filter by type' }));
      await user.click(await screen.findByRole('option', { name: 'Income' }));

      const { filters } = useTransactionStore.getState();
      expect(filters.type).toBe('income');
      expect(filters.page).toBe(1);
    });

    it('counts as an active filter, so Reset clears it', async () => {
      const user = userEvent.setup();
      mockFetch({ 'GET /categories': { body: [] } });
      useTransactionStore.setState({ filters: { ...DEFAULT_FILTERS, type: 'expense' } });
      renderWithProviders(<TransactionFilters />);

      expect(hasActiveFilters(useTransactionStore.getState().filters)).toBe(true);
      await user.click(screen.getByRole('button', { name: /reset filters/i }));

      expect(useTransactionStore.getState().filters.type).toBe('');
    });
  });

  describe('API request', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    );

    it('sends ?type= when filtering by type', async () => {
      const fetchMock = mockFetch({
        'GET /transactions': { body: { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } } },
      });

      renderHook(() => useTransactions({ ...DEFAULT_FILTERS, type: 'income' }), { wrapper });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
      expect(url.searchParams.get('type')).toBe('income');
    });

    it('omits type when not filtering', async () => {
      const fetchMock = mockFetch({
        'GET /transactions': { body: { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } } },
      });

      renderHook(() => useTransactions(DEFAULT_FILTERS), { wrapper });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
      expect(url.searchParams.has('type')).toBe(false);
    });

    it("reads NestJS's type from the response", async () => {
      mockFetch({
        'GET /transactions': {
          body: {
            data: [{ ...tx({}), type: 'income', status: 'completed', category: { id: 'c1', name: 'Salary' } }],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          },
        },
      });

      const { result } = renderHook(() => useTransactions(DEFAULT_FILTERS), { wrapper });

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data!.data[0]).toMatchObject({ type: 'income', status: 'Completed', category: 'Salary' });
    });
  });
});
