// app/services/categoryService.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Category } from '@/app/types';
import { request } from '@/app/services/transactionService';

export const categoriesQueryKey = ['categories'] as const;

export const useCategories = () => {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: ({ signal }) => request<Category[]>('/api/categories', { signal }),
    // Guard the UI (it calls .map) against an unexpected response shape.
    select: (data) => (Array.isArray(data) ? data : []),
    retry: 1,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      request<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (category) => {
      // Put the new category straight into the cache so the dropdown updates
      // without waiting for a refetch...
      queryClient.setQueryData<Category[]>(categoriesQueryKey, (prev = []) =>
        [...prev, category].sort((a, b) => a.name.localeCompare(b.name))
      );
      // ...then resync in the background. Not returned, so the mutation (and
      // the dialog's "Creating..." state) doesn't wait for it.
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
  });
};
