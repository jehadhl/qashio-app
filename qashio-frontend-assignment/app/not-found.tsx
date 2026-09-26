// app/not-found.tsx - a client component because it renders MUI, which can't
// run as a server component.
'use client';

import Link from 'next/link';
import { Button } from '@mui/material';
import ErrorState from '@/app/components/common/ErrorState';

export default function NotFound() {
  return (
    <ErrorState
      title="Page not found"
      message="The page you are looking for does not exist."
      action={
        <Button component={Link} href="/transactions" variant="contained" disableElevation sx={{ textTransform: 'none' }}>
          Back to transactions
        </Button>
      }
    />
  );
}
