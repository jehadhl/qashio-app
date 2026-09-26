// components/transactions/TypeBadge.tsx
'use client';

import { Box } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Transaction } from '@/app/types';

type TxType = Transaction['type'];

// Income is money in (green, arrow down into the account); expense is money out (red).
export const TYPE_STYLES: Record<TxType, { label: string; color: string; bgColor: string; sign: string }> = {
  income: { label: 'Income', color: '#12a150', bgColor: '#e3f8ee', sign: '+' },
  expense: { label: 'Expense', color: '#d32f2f', bgColor: '#fdeaea', sign: '−' },
};

const ICONS: Record<TxType, typeof ArrowUpwardIcon> = {
  income: ArrowDownwardIcon,
  expense: ArrowUpwardIcon,
};

// Same soft-pill look as StatusBadge.
export default function TypeBadge({ type }: { type: TxType }) {
  const { label, color, bgColor } = TYPE_STYLES[type] ?? TYPE_STYLES.expense;
  const Icon = ICONS[type] ?? ICONS.expense;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        pl: 1,
        pr: 1.5,
        py: 0.5,
        borderRadius: '999px',
        backgroundColor: bgColor,
        color,
        fontSize: '0.85rem',
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon sx={{ fontSize: '0.95rem' }} />
      {label}
    </Box>
  );
}
