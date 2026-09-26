// app/(auth)/layout.tsx - login/register use their own layout (no sidebar or navbar).
import { ReactNode } from 'react';
import AuthLayout from '@/app/components/auth/AuthLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
