// app/(auth)/login/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PasswordField from '@/app/components/auth/PasswordField';
import { useLogin } from '@/app/services/authService';
import { useToastStore } from '@/app/hooks/useToastStore';
import { fieldErrors, LoginInput, loginSchema } from '@/lib/validators/auth';

type FormErrors = Partial<Record<keyof LoginInput, string>>;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { mutate: login, isPending } = useLogin();
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(fieldErrors<keyof LoginInput>(result.error));
      return;
    }
    setErrors({});

    login(
      { ...result.data, rememberMe },
      {
        // useLogin then takes the user to /transactions.
        onSuccess: ({ user }) => showToast(`Welcome back, ${user.firstName}!`, 'success'),
        onError: (error) => showToast(error.message || 'Could not sign you in', 'error'),
      }
    );
  };

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        Welcome back
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        Sign in to continue to your transactions.
      </Typography>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            fullWidth
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={!!errors.email}
            helperText={errors.email}
            disabled={isPending}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            fullWidth
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={!!errors.password}
            helperText={errors.password}
            disabled={isPending}
          />
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isPending}
              />
            }
            label={<Typography variant="body2">Remember me</Typography>}
          />
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disableElevation
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ mt: 2, py: 1.3, textTransform: 'none', fontWeight: 600 }}
        >
          {isPending ? 'Signing in...' : 'Sign in'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Don&apos;t have an account?{' '}
        <Box component={Link} href="/register" sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}>
          Create one
        </Box>
      </Typography>
    </>
  );
}
