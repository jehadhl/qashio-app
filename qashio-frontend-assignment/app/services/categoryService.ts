// app/services/categoryService.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Category } from '@/app/types';
import { apiUrl } from '@/app/services/apiClient';
import { request } from '@/app/services/transactionService';

export const categoriesQueryKey = ['categories'] as const;

export const useCategories = () => {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: ({ signal }) => request<Category[]>(apiUrl('/categories'), { signal }),
    // Guard the UI (it calls .map) against an unexpected response shape.
    select: (data) => (Array.isArray(data) ? data : []),
    retry: 1,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      request<Category>(apiUrl('/categories'), {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (category) => {
     
      queryClient.setQueryData<Category[]>(categoriesQueryKey, (prev = []) =>
        [...prev, category].sort((a, b) => a.name.localeCompare(b.name))
      );
     
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
  });
};
