// app/(auth)/register/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import PasswordField from '@/app/components/auth/PasswordField';
import { useRegister } from '@/app/services/authService';
import { useToastStore } from '@/app/hooks/useToastStore';
import { fieldErrors, RegisterInput, registerSchema } from '@/lib/validators/auth';

type FormValues = RegisterInput;
type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_FORM: FormValues = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const { mutate: register, isPending } = useRegister();
  const showToast = useToastStore((state) => state.showToast);

  const field = (name: keyof FormValues) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [name]: e.target.value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    error: !!errors[name],
    disabled: isPending,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Zod checks the same rules as the API and returns trimmed, normalised values.
    const result = registerSchema.safeParse(values);
    if (!result.success) {
      setErrors(fieldErrors<keyof FormValues>(result.error));
      return;
    }
    setErrors({});

    const { confirmPassword: _, ...payload } = result.data;
    register(payload, {
      // useRegister then takes the user to /transactions.
      onSuccess: ({ user }) => showToast(`Welcome, ${user.firstName}! Your account is ready.`, 'success'),
      onError: (error) => showToast(error.message || 'Could not create your account', 'error'),
    });
  };

  return (
    <>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        Create your account
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        Start tracking your income and expenses.
      </Typography>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First name"
              autoComplete="given-name"
              fullWidth
              {...field('firstName')}
              helperText={errors.firstName}
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              fullWidth
              {...field('lastName')}
              helperText={errors.lastName}
            />
          </Stack>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            fullWidth
            {...field('email')}
            helperText={errors.email}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            fullWidth
            {...field('password')}
            helperText={errors.password ?? 'At least 8 characters'}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            fullWidth
            {...field('confirmPassword')}
            helperText={errors.confirmPassword}
          />
        </Stack>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disableElevation
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ mt: 3, py: 1.3, textTransform: 'none', fontWeight: 600 }}
        >
          {isPending ? 'Creating account...' : 'Create account'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Already have an account?{' '}
        <Box component={Link} href="/login" sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}>
          Sign in
        </Box>
      </Typography>
    </>
  );
}
