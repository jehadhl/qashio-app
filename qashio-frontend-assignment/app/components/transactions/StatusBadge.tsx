// components/transactions/StatusBadge.tsx
'use client';

import { Box } from '@mui/material';
import { Transaction } from '@/app/types';

interface StatusBadgeProps {
  status: Transaction['status'];
}

// Soft pill style: tinted background, matching darker text, no border.
const STATUS_STYLES: Record<Transaction['status'], { bgColor: string; textColor: string }> = {
  Completed: { bgColor: '#e3f8ee', textColor: '#12a150' },
  Pending: { bgColor: '#fff4e0', textColor: '#c77700' },
  Failed: { bgColor: '#fdeaea', textColor: '#d32f2f' },
};

const FALLBACK_STYLE = { bgColor: '#f0f0f3', textColor: '#6b6b76' };

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { bgColor, textColor } = STATUS_STYLES[status] ?? FALLBACK_STYLE;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 1.75,
        py: 0.5,
        borderRadius: '999px',
        backgroundColor: bgColor,
        color: textColor,
        fontSize: '0.85rem',
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </Box>
  );
}
