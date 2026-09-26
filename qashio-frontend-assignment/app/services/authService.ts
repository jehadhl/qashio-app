'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoginRequest, RegisterPayload, User } from '@/app/types';
import { apiClient, refreshSession } from '@/app/services/apiClient';
import { clearPersistedCache } from '@/app/services/queryCache';

interface AuthResponse {
  user: User;
}

export const authService = {
  login: (payload: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', payload, { skipAuthRefresh: true }),
  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', payload, { skipAuthRefresh: true }),
  refresh: refreshSession,
  logout: () => apiClient.post<{ success: true }>('/auth/logout', undefined, { skipAuthRefresh: true }),
};

export const currentUserQueryKey = ['currentUser'] as const;

// The signed-in user (GET /users/me), shown in the navbar, sidebar and profile page.
export const useCurrentUser = () => {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => apiClient.get<User>('/users/me', { signal }),
    retry: 1,
  });
};

export const useLogin = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: ({ user }) => {
      // Start clean: the cache may hold another user's data.
      queryClient.clear();
      clearPersistedCache();
      queryClient.setQueryData(currentUserQueryKey, user);
      router.replace('/transactions');
    },
  });
};

export const useRegister = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.register,
    onSuccess: ({ user }) => {
      // Start clean: the cache may hold another user's data.
      queryClient.clear();
      clearPersistedCache();
      queryClient.setQueryData(currentUserQueryKey, user);
      router.replace('/transactions');
    },
  });
};

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    // Signed out either way; drop the previous user's cached data.
    onSettled: () => {
      queryClient.clear();
      clearPersistedCache();
      router.replace('/login');
    },
  });
};
