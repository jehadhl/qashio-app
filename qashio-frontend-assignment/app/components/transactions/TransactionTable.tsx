// components/transactions/TransactionTable.tsx
'use client';

import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { format } from 'date-fns';
import { Transaction } from '@/app/types';
import { SortBy, useTransactionStore } from '@/app/hooks/useTransactionStore';
import StatusBadge from './StatusBadge';
import TypeBadge, { TYPE_STYLES } from './TypeBadge';
import TransactionDetailDrawer from './TransactionDetailDrawer';
import DeleteTransactionDialog from './DeleteTransactionDialog';

interface TransactionTableProps {
  data?: Transaction[];
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatAmount = (amount: number) => `${amountFormatter.format(amount)} AED`;

// Signed by type: "+250.00 AED" for income, "−250.00 AED" for expenses.
const formatSignedAmount = (row: Transaction) =>
  `${(TYPE_STYLES[row.type] ?? TYPE_STYLES.expense).sign}${formatAmount(row.amount)}`;

// checkbox | date | reference | counterparty | type | amount | status | actions
export const GRID_COLUMNS = '60px 1fr 1fr 1fr 120px 1fr 1fr 140px';

const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'dd MMM yyyy');
};

export default function TransactionTable({ data = [] }: TransactionTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const router = useRouter();

  const handleEdit = (transaction: Transaction) =>
    router.push(`/transactions/${encodeURIComponent(transaction.id)}/edit`);
  const { sortBy, sortOrder } = useTransactionStore((state) => state.filters);
  const toggleSort = useTransactionStore((state) => state.toggleSort);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(data.map((row) => row.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderSortIcon = (field: SortBy) => {
    if (sortBy !== field) return null;
    const Icon = sortOrder === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;
    return <Icon sx={{ fontSize: '0.95rem', ml: 0.5, verticalAlign: 'middle' }} />;
  };

  const SortableHeaderCell = ({ field, label }: { field: SortBy; label: string }) => (
    <Box
      onClick={() => toggleSort(field)}
      sx={{
        fontSize: '0.9rem',
        fontWeight: 600,
        color: '#333',
        textAlign: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover': { color: 'primary.main' },
      }}
    >
      {label}
      {renderSortIcon(field)}
    </Box>
  );

  return (
    <Box sx={{ bgcolor: '#fff' }}>
      {/* Table Header Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 0,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#fff',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Checkbox
            indeterminate={selected.length > 0 && selected.length < data.length}
            checked={data.length > 0 && selected.length === data.length}
            onChange={handleSelectAll}
            size="small"
          />
        </Box>
        <SortableHeaderCell field="date" label="Date" />
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', textAlign: 'center' }}>
          Reference
        </Box>
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', textAlign: 'center' }}>
          Counterparty
        </Box>
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', textAlign: 'center' }}>
          Type
        </Box>
        <SortableHeaderCell field="amount" label="Amount" />
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', textAlign: 'center' }}>
          Status
        </Box>
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', textAlign: 'center' }}>
          Actions
        </Box>
      </Box>

      {/* Table Rows */}
      {data.length === 0 ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No transactions found
          </Typography>
        </Box>
      ) : (
        data.map((row) => (
          <Box
            key={row.id}
            role="button"
            tabIndex={0}
            aria-label={`View transaction ${row.reference}`}
            onClick={() => setViewingId(row.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setViewingId(row.id);
              }
            }}
            sx={{
              display: 'grid',
              gridTemplateColumns: GRID_COLUMNS,
              gap: 0,
              px: 2,
              py: 1.5,
              borderBottom: '1px solid #e0e0e0',
              bgcolor: selected.includes(row.id) ? '#f5f5f5' : '#fff',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: '#f9f9f9',
              },
              '&:focus-visible': {
                outline: '2px solid', outlineColor: 'primary.main',
                outlineOffset: -2,
              },
              alignItems: 'center',
            }}
          >
            {/* Selecting a row shouldn't also open its details */}
            <Box
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Checkbox
                checked={selected.includes(row.id)}
                onChange={() => handleSelectOne(row.id)}
                size="small"
              />
            </Box>
            <Box sx={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
              {formatDate(row.date)}
            </Box>
            <Box sx={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
              {row.reference}
            </Box>
            <Box sx={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
              {row.counterparty}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <TypeBadge type={row.type} />
            </Box>
            <Box
              sx={{
                fontSize: '0.9rem',
                fontWeight: 600,
                textAlign: 'center',
                color: (TYPE_STYLES[row.type] ?? TYPE_STYLES.expense).color,
              }}
            >
              {formatSignedAmount(row)}
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <StatusBadge status={row.status} />
            </Box>
            {/* Action buttons handle their own clicks, not the row's */}
            <Box
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}
            >
              <Tooltip title="View details">
                <IconButton
                  size="small"
                  aria-label={`View ${row.reference}`}
                  onClick={() => setViewingId(row.id)}
                  sx={{ color: '#666', '&:hover': { color: 'primary.main' } }}
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  aria-label={`Edit ${row.reference}`}
                  onClick={() => handleEdit(row)}
                  sx={{ color: '#666', '&:hover': { color: 'primary.main' } }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  aria-label={`Delete ${row.reference}`}
                  onClick={() => setDeleting(row)}
                  sx={{ color: '#666', '&:hover': { color: '#d32f2f' } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ))
      )}

      <TransactionDetailDrawer
        transactionId={viewingId}
        onClose={() => setViewingId(null)}
        onEdit={handleEdit}
        onDelete={setDeleting}
      />

      <DeleteTransactionDialog
        transaction={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          setSelected((prev) => prev.filter((item) => item !== id));
          if (viewingId === id) setViewingId(null);
        }}
      />
    </Box>
  );
}
