
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Box, Breadcrumbs, Button, Skeleton, Typography } from '@mui/material';
import TransactionForm from '@/app/components/transactions/TransactionForm';
import { TransactionApiError, useTransaction } from '@/app/services/transactionService';
import { useToastStore } from '@/app/hooks/useToastStore';

export default function EditTransactionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const showToast = useToastStore((state) => state.showToast);

  const { data: transaction, isLoading, error, refetch } = useTransaction(id);
  const notFound = error instanceof TransactionApiError && error.status === 404;

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Breadcrumbs sx={{ fontSize: '0.85rem' }}>
        <Link href="/transactions" style={{ color: 'inherit', textDecoration: 'none' }}>
          Transactions
        </Link>
        <Typography color="text.primary" fontSize="inherit">
          {transaction?.reference ?? 'Edit'}
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1">
        Edit Transaction
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Update the details of this transaction.
      </Typography>

      {isLoading ? (
        <Skeleton variant="rounded" height={480} sx={{ borderRadius: 2 }} />
      ) : error ? (
        <Alert
          severity={notFound ? 'warning' : 'error'}
          action={
            notFound ? (
              <Button color="inherit" size="small" onClick={() => router.push('/transactions')}>
                Back to list
              </Button>
            ) : (
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            )
          }
        >
          {notFound ? 'This transaction does not exist.' : 'Could not load this transaction.'}
        </Alert>
      ) : (
        transaction && (
          <TransactionForm
            transaction={transaction}
            onSuccess={(updated) => {
              showToast(`Transaction ${updated.reference} updated`);
              router.push('/transactions');
            }}
            onCancel={() => router.back()}
          />
        )
      )}
    </Box>
  );
}
