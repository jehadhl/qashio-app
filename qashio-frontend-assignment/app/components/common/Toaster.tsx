// components/common/Toaster.tsx
'use client';

import { Alert, Snackbar } from '@mui/material';
import { useToastStore } from '@/app/hooks/useToastStore';

export default function Toaster() {
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);

  return (
    <Snackbar
      key={toast?.id}
      open={!!toast}
      autoHideDuration={3000}
      onClose={(_, reason) => reason !== 'clickaway' && hideToast()}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert severity={toast?.severity ?? 'success'} variant="filled" onClose={hideToast} sx={{ width: '100%' }}>
        {toast?.message}
      </Alert>
    </Snackbar>
  );
}
