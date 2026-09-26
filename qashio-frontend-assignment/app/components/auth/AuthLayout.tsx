// components/auth/AuthLayout.tsx
'use client';

import { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Toaster from '@/app/components/common/Toaster';
import { BRAND } from '@/app/components/common/brand';

const HIGHLIGHTS = [
  'Track income and expenses in one place',
  'Organise spending with your own categories',
  'Filter, sort and review every transaction',
];

const ACCENT = BRAND.main;

// Split screen: brand panel on the left (hidden on small screens), form on the right.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 6,
            color: '#fff',
            background: `linear-gradient(145deg, #2a2317 0%, ${ACCENT} 100%)`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Soft decorative glow */}
          <Box
            sx={{
              position: 'absolute',
              width: 420,
              height: 420,
              borderRadius: '50%',
              right: -140,
              bottom: -140,
              background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)',
            }}
          />

          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            Qashio
          </Typography>

          <Box sx={{ position: 'relative', maxWidth: 420 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mb: 2 }}>
              Your money, clearly accounted for.
            </Typography>
            <Typography sx={{ opacity: 0.8, mb: 4 }}>
              A simple expense tracker for keeping every transaction in order.
            </Typography>
            <Stack spacing={1.5}>
              {HIGHLIGHTS.map((text) => (
                <Stack key={text} direction="row" spacing={1.5} alignItems="center">
                  <CheckCircleOutlineIcon sx={{ color: '#f1e6d0' }} fontSize="small" />
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {text}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Typography variant="caption" sx={{ opacity: 0.6, position: 'relative' }}>
            © {new Date().getFullYear()} Qashio
          </Typography>
        </Box>

        <Box
          component="main"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            py: { xs: 4, md: 6 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 440,
              p: { xs: 3, sm: 4.5 },
              border: '1px solid #e5e7eb',
              borderRadius: 3,
            }}
          >
            {/* Brand shown here when the side panel is hidden */}
            <Typography
              variant="h6"
              sx={{ display: { xs: 'block', md: 'none' }, fontWeight: 700, color: 'primary.main', mb: 3 }}
            >
              Qashio
            </Typography>
            {children}
          </Paper>
        </Box>
      </Box>
      <Toaster />
    </>
  );
}
