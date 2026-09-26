// app/transactions/page.tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Box, Typography, Alert, Button } from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TransactionTable from "@/app/components/transactions/TransactionTable";
import TransactionFilters from "@/app/components/transactions/TransactionFilters";
import TransactionTableSkeleton from "@/app/components/transactions/TransactionTableSkeleton";
import Pagination from "@/app/components/common/Pagination";
import { brandButtonSx } from "@/app/components/common/brand";
import { useTransactions } from "@/app/services/transactionService";
import {
  hasActiveFilters,
  useTransactionFilters,
} from "@/app/hooks/useTransactionStore";

function TransactionsPageContent() {
  const { filters, hydrated, setPage } = useTransactionFilters();

  const { data, isLoading, isPlaceholderData, error } = useTransactions(
    filters,
    hydrated,
  );

  // The React Query cache is restored from localStorage on the client, so it can hold
  // data the server never had. Ignore it until `hydrated` (set in an effect, false on
  // the server) so the first client render matches the server HTML.
  const pagination = hydrated ? data?.pagination : undefined;
  const isFiltered = hasActiveFilters(filters);

  // The user has no transactions at all (not just none matching a filter): show an
  // empty state instead of search/filter/sort controls that could only ever return
  // nothing - each of them would be a pointless request to the backend.
  const hasNoTransactions = !!pagination && pagination.total === 0 && !isFiltered;

  // Only offer filters once we know there is something to filter. While a filtered
  // result is empty they stay, so the user can change or reset them.
  const showFilters = isFiltered || (!!pagination && pagination.total > 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <Box>
        <Typography variant="h4" component="h1">
          Transactions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage your transactions
        </Typography>
      </Box>

      {showFilters && <TransactionFilters />}

      {hydrated && error ? (
        <Alert severity="error">Error loading transactions</Alert>
      ) : hasNoTransactions ? (
        <Box
          sx={{
            bgcolor: "#fff",
            py: 8,
            px: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1,
          }}
        >
          <ReceiptLongOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography variant="h6">No transactions yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add your first transaction to start tracking your spending.
          </Typography>
          <Button
            component={Link}
            href="/transactions/new"
            sx={brandButtonSx}
          >
            Add transaction
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            bgcolor: "#fff",
            opacity: isPlaceholderData ? 0.6 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          {!hydrated || isLoading ? (
            <TransactionTableSkeleton rows={Math.min(filters.limit, 10)} />
          ) : (
            <>
              <TransactionTable data={data?.data ?? []} />
              {pagination && pagination.total > 0 && (
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={pagination.limit}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionTableSkeleton />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
