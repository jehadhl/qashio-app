// app/services/queryCache.ts - React Query cache that survives a page refresh.
//
// Successful queries are saved to localStorage, so reloading /transactions shows the
// cached list straight away and only refetches once it is stale. Every mutation
// (create/update/delete transaction, create category) invalidates what it changes,
// so the cache never shows data the user has just changed.
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const STORAGE_KEY = 'qashio-query-cache';

// How long cached data counts as fresh. Our own changes invalidate it immediately;
// this only bounds how long changes made elsewhere (another tab or device) can go unseen.
export const STALE_TIME = 1000 * 60 * 30;

// Saved cache older than this is thrown away on load. Must not exceed gcTime,
// or queries are garbage-collected before they can be restored.
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

// Bump when the shape of cached data changes, so old caches are discarded.
export const CACHE_BUSTER = 'v1';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME, gcTime: CACHE_MAX_AGE },
    },
  });

// On the server there is no localStorage; the persister then does nothing.
export const queryPersister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: STORAGE_KEY,
});

// The cache holds the signed-in user's financial data: drop it whenever the user
// changes (login, register, logout, expired session).
export const clearPersistedCache = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, blocked): nothing was saved anyway.
  }
};
