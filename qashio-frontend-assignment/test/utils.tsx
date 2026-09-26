// test/utils.tsx - helpers for UI tests: a real React Query client and a fetch mock
// that answers by "METHOD /path", so components run their real data flow.
import { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Toaster from '@/app/components/common/Toaster';

export const testUser = {
  id: 'user-1',
  email: 'demo@qashio.com',
  firstName: 'Demo',
  lastName: 'User',
  role: 'user' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

// Renders inside a fresh QueryClient, with the Toaster so alerts are visible.
export function renderWithProviders(ui: ReactElement, queryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper }) };
}

// Replaces the next/navigation router with spies the test can assert on.
export function mockRouter() {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };
  (useRouter as jest.Mock).mockReturnValue(router);
  return router;
}

export interface MockReply {
  status?: number;
  body?: unknown;
}

type Route = MockReply | ((request: { url: string; init?: RequestInit; body: unknown }) => MockReply | Promise<MockReply>);

// Minimal Response stand-in: jsdom has no fetch/Response, and the app only uses these.
const fakeResponse = ({ status = 200, body }: MockReply) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('No body')) : Promise.resolve(body)),
  }) as Response;

// global.fetch mock keyed by "METHOD /path" (query string ignored). Unknown routes fail
// the test loudly, so a component can't silently call something unexpected.
export function mockFetch(routes: Record<string, Route>) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.split('?')[0];
    const route = routes[`${method} ${path}`];
    if (!route) throw new Error(`Unexpected fetch: ${method} ${url}`);

    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const reply = typeof route === 'function' ? await route({ url, init, body }) : route;
    return fakeResponse(reply);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

// Calls made to one route, with their parsed JSON bodies.
export const callsTo = (fetchMock: jest.Mock, method: string, path: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => (init?.method ?? 'GET').toUpperCase() === method && String(url).split('?')[0] === path)
    .map(([, init]) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined));

// A promise the test resolves by hand, to hold a request "in flight".
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
