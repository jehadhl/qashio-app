'use client';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ReactNode, useState } from 'react';
import { BRAND } from '@/app/components/common/brand';
import { CACHE_BUSTER, CACHE_MAX_AGE, createQueryClient, queryPersister } from '@/app/services/queryCache';

const theme = createTheme({
  palette: {
    primary: {
      main: BRAND.main,
      dark: BRAND.dark,
      contrastText: '#fff',
    },
    secondary: {
      main: '#19857b',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
    >
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <CssBaseline />
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
} 