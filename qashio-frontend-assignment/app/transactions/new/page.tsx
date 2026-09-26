'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  LinearProgress,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TransactionForm from '@/app/components/transactions/TransactionForm';
import { Transaction } from '@/app/types';

const REDIRECT_DELAY_MS = 2000;

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function NewTransactionPage() {
  const router = useRouter();
  const [created, setCreated] = useState<Transaction | null>(null);
  const [formKey, setFormKey] = useState(0);


  useEffect(() => {
    if (!created) return;
    const timer = setTimeout(() => router.push('/transactions'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [created, router]);

  const handleAddAnother = () => {
    setCreated(null);
    setFormKey((key) => key + 1); 
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Breadcrumbs sx={{ fontSize: '0.85rem' }}>
        <Link href="/transactions" style={{ color: 'inherit', textDecoration: 'none' }}>
          Transactions
        </Link>
        <Typography color="text.primary" fontSize="inherit">
          New
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1">
        New Transaction
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Record a payment and it will show up in your transactions list.
      </Typography>

      {created ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            border: '1px solid #e5e7eb',
            borderRadius: 2,
            textAlign: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h6">Transaction created</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            {created.reference} · {created.counterparty} ·{' '}
            {amountFormatter.format(created.amount)} AED
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
            <Button onClick={handleAddAnother} sx={{ textTransform: 'none' }}>
              Add another
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={() => router.push('/transactions')}
              sx={{ textTransform: 'none' }}
            >
              View transactions
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Redirecting to transactions...
          </Typography>
          <LinearProgress
            color="success"
            sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          />
        </Paper>
      ) : (
        <TransactionForm
          key={formKey}
          onSuccess={setCreated}
          onCancel={() => router.push('/transactions')}
        />
      )}

      <Snackbar
        open={!!created}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          Transaction created successfully
        </Alert>
      </Snackbar>
    </Box>
  );
}
