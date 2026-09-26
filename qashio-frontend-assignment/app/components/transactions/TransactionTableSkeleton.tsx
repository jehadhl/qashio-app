// components/transactions/TransactionTableSkeleton.tsx
'use client';

import { Box, Skeleton } from '@mui/material';
import { GRID_COLUMNS } from './TransactionTable';

const HEADERS = ['', 'Date', 'Reference', 'Counterparty', 'Type', 'Amount', 'Status', 'Actions'];

const rowSx = {
  display: 'grid',
  gridTemplateColumns: GRID_COLUMNS,
  px: 2,
  py: 1.5,
  borderBottom: '1px solid #e0e0e0',
  alignItems: 'center',
  justifyItems: 'center',
} as const;

// Same grid as TransactionTable, so nothing jumps when the real rows arrive.
export default function TransactionTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Box sx={{ bgcolor: '#fff' }} aria-busy="true" aria-label="Loading transactions">
      <Box sx={rowSx}>
        {HEADERS.map((label, i) =>
          label ? (
            <Box key={label} sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>
              {label}
            </Box>
          ) : (
            <Skeleton key={i} variant="rounded" width={18} height={18} />
          )
        )}
      </Box>

      {Array.from({ length: rows }, (_, i) => (
        <Box key={i} sx={{ ...rowSx, py: 2 }}>
          <Skeleton variant="rounded" width={18} height={18} />
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width={`${50 + ((i * 17) % 30)}%`} />
          <Skeleton variant="rounded" width={80} height={24} sx={{ borderRadius: 3 }} />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="rounded" width={84} height={24} sx={{ borderRadius: 3 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="circular" width={24} height={24} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
