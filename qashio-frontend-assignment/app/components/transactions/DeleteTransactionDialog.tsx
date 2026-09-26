// components/transactions/DeleteTransactionDialog.tsx
'use client';

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { Transaction } from '@/app/types';
import { useDeleteTransaction } from '@/app/services/transactionService';
import { useToastStore } from '@/app/hooks/useToastStore';

interface DeleteTransactionDialogProps {
  transaction: Transaction | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

export default function DeleteTransactionDialog({
  transaction,
  onClose,
  onDeleted,
}: DeleteTransactionDialogProps) {
  const showToast = useToastStore((state) => state.showToast);
  const { mutate, isPending, error, reset } = useDeleteTransaction();

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const handleDelete = () => {
    if (!transaction) return;
    mutate(transaction.id, {
      onSuccess: () => {
        showToast(`Transaction ${transaction.reference} deleted`);
        onDeleted?.(transaction.id);
        reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={!!transaction} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Delete transaction?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}
        <DialogContentText>
          <strong>{transaction?.reference}</strong> with {transaction?.counterparty} will be
          permanently deleted. This can&apos;t be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isPending} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disableElevation
          onClick={handleDelete}
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: 'none' }}
        >
          {isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
