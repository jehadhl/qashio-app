// components/categories/CreateCategoryDialog.tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Category } from '@/app/types';
import { CATEGORY_NAME_MAX, createCategorySchema } from '@/lib/validators/category';
import { useCreateCategory } from '@/app/services/categoryService';
import { TransactionApiError } from '@/app/services/transactionService';

interface CreateCategoryDialogProps {
  open: boolean;
  // Pre-fills the name, e.g. with what the user already typed in the dropdown.
  initialName?: string;
  onClose: () => void;
  onCreated: (category: Category) => void;
}

export default function CreateCategoryDialog({
  open,
  initialName = '',
  onClose,
  onCreated,
}: CreateCategoryDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending, reset } = useCreateCategory();

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
      reset();
    }
  }, [open, initialName, reset]);

  const handleClose = () => {
    if (!isPending) onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Keep the submit from bubbling to the transaction form this dialog is opened from.
    event.stopPropagation();

    const result = createCategorySchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid name');
      return;
    }

    mutate(result.data.name, {
      onSuccess: onCreated,
      onError: (err) =>
        setError(
          err instanceof TransactionApiError && err.details.length
            ? err.details[0].message
            : err.message
        ),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Create Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            required
            label="Name"
            placeholder="e.g. Groceries"
            margin="dense"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={!!error}
            helperText={error}
            disabled={isPending}
            slotProps={{ htmlInput: { maxLength: CATEGORY_NAME_MAX } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isPending} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none' }}
          >
            {isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
