
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const STORAGE_KEY = 'qashio-query-cache';


export const STALE_TIME = 1000 * 60 * 30;


export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;


export const CACHE_BUSTER = 'v1';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME, gcTime: CACHE_MAX_AGE },
    },
  });

export const queryPersister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: STORAGE_KEY,
});


export const clearPersistedCache = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
};
