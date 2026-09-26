import { clearPersistedCache } from '@/app/services/queryCache';

const BASE_URL = '/api';

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: ApiFieldError[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  params?: QueryParams;
  body?: unknown;
  skipAuthRefresh?: boolean;
}

const buildUrl = (path: string, params?: QueryParams) => {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${url}?${query}` : url;
};

let refreshInFlight: Promise<boolean> | null = null;

export const refreshSession = (): Promise<boolean> => {
  refreshInFlight ??= fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    // Session is over: don't leave this user's cached data behind.
    clearPersistedCache();
    window.location.assign('/login');
  }
};

// NestJS wraps single results as { success, data, timestamp }; the mock API returns
// them bare. Paginated lists ({ data, pagination }) are already the shape we use.
export const unwrapEnvelope = (body: unknown): unknown => {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body && !('pagination' in body)) {
    return (body as { data: unknown }).data;
  }
  return body;
};

async function send<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, skipAuthRefresh, headers, ...init } = options;

  const response = await fetch(buildUrl(path, params), {
    ...init,
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && !skipAuthRefresh) {
    if (await refreshSession()) {
      return send<T>(method, path, { ...options, skipAuthRefresh: true });
    }
    redirectToLogin();
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message ?? data?.message ?? `API error: ${response.status}`,
      response.status,
      data?.error?.details ?? []
    );
  }

  return unwrapEnvelope(data) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => send<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    send<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => send<T>('DELETE', path, options),
};
