// components/common/ErrorState.tsx
'use client';

import { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface ErrorStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

// Shared body for the route error / not-found pages.
export default function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1.5,
        py: 10,
        px: 2,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        {message}
      </Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}

export const retryButton = (onRetry: () => void) => (
  <Button variant="contained" disableElevation onClick={onRetry} sx={{ textTransform: 'none' }}>
    Try again
  </Button>
);
