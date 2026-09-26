// components/transactions/TransactionDetailDrawer.tsx
'use client';

import { ReactNode, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { format } from 'date-fns';
import { Transaction } from '@/app/types';
import { TransactionApiError, useTransaction } from '@/app/services/transactionService';
import StatusBadge from './StatusBadge';
import TypeBadge, { TYPE_STYLES } from './TypeBadge';

interface TransactionDetailDrawerProps {
  transactionId: string | null;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDateTime = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, "dd MMM yyyy 'at' HH:mm");
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - nothing useful to do.
    }
  };

  return (
    <Tooltip title={copied ? 'Copied' : 'Copy'}>
      <IconButton size="small" onClick={handleCopy} sx={{ ml: 0.5, color: '#999' }}>
        {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '130px 1fr',
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Typography sx={{ fontSize: '0.85rem', color: '#888' }}>{label}</Typography>
      <Box
        sx={{
          fontSize: '0.9rem',
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function DrawerSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" height={150} sx={{ mb: 2, borderRadius: 2 }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height={44} />
      ))}
      <Skeleton variant="rounded" height={80} sx={{ mt: 3, borderRadius: 2 }} />
    </Box>
  );
}

function TransactionDetails({ tx }: { tx: Transaction }) {
  return (
    <>
      {/* Summary */}
      <Box
        sx={{
          textAlign: 'center',
          p: 3,
          mb: 2,
          borderRadius: 2,
          bgcolor: '#f8f9fa',
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', color: '#888', mb: 0.5 }}>Amount</Typography>
        <Typography
          sx={{
            fontSize: '2rem',
            fontWeight: 700,
            lineHeight: 1.2,
            color: (TYPE_STYLES[tx.type] ?? TYPE_STYLES.expense).color,
          }}
        >
          {(TYPE_STYLES[tx.type] ?? TYPE_STYLES.expense).sign}
          {amountFormatter.format(tx.amount)}{' '}
          <Box component="span" sx={{ fontSize: '1rem', fontWeight: 500, color: '#888' }}>
            AED
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: '#666', mt: 0.5, mb: 1.5 }}>
          {tx.counterparty}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <TypeBadge type={tx.type} />
          <StatusBadge status={tx.status} />
        </Box>
      </Box>

      {/* Details */}
      <DetailRow label="Reference">
        {tx.reference}
        <CopyButton value={tx.reference} />
      </DetailRow>
      <DetailRow label="Counterparty">{tx.counterparty}</DetailRow>
      <DetailRow label="Category">{tx.category || '—'}</DetailRow>
      <DetailRow label="Date">{formatDateTime(tx.date)}</DetailRow>
      <DetailRow label="Transaction ID">
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {tx.id}
        </Box>
        <CopyButton value={tx.id} />
      </DetailRow>

      {/* Narration */}
      <Typography sx={{ fontSize: '0.85rem', color: '#888', mt: 3, mb: 1 }}>Narration</Typography>
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid #f0f0f0',
          fontSize: '0.9rem',
          color: tx.narration ? '#333' : '#aaa',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {tx.narration || 'No narration provided'}
      </Box>
    </>
  );
}

export default function TransactionDetailDrawer({
  transactionId,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailDrawerProps) {
  // Keep the last id around while the drawer animates closed,
  // so the content doesn't blank out mid-slide.
  const [lastId, setLastId] = useState<string | null>(transactionId);
  if (transactionId && transactionId !== lastId) setLastId(transactionId);

  // Always read fresh details from GET /api/transactions/:id.
  const { data: tx, isLoading, error, refetch } = useTransaction(transactionId ?? lastId);
  const notFound = error instanceof TransactionApiError && error.status === 404;

  return (
    <Drawer
      anchor="right"
      open={!!transactionId}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 } } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Transaction Details
          </Typography>
          <IconButton onClick={onClose} aria-label="Close details">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ px: 3, py: 3, overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <DrawerSkeleton />
          ) : error ? (
            <Alert
              severity={notFound ? 'warning' : 'error'}
              action={
                !notFound && (
                  <Button color="inherit" size="small" onClick={() => refetch()}>
                    Retry
                  </Button>
                )
              }
            >
              {notFound ? 'This transaction no longer exists.' : 'Could not load transaction details.'}
            </Alert>
          ) : (
            tx && <TransactionDetails tx={tx} />
          )}
        </Box>

        {tx && !error && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', gap: 1.5, px: 3, py: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => onDelete(tx)}
                sx={{ textTransform: 'none' }}
              >
                Delete
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<EditOutlinedIcon />}
                onClick={() => onEdit(tx)}
                sx={{ textTransform: 'none' }}
              >
                Edit
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
