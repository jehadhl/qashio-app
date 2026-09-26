'use client';

import { useEffect } from 'react';
import ErrorState, { retryButton } from '@/app/components/common/ErrorState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message="This page failed to load. Please try again."
      action={retryButton(reset)}
    />
  );
}
