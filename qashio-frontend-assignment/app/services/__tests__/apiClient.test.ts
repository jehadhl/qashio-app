// Unit: the fetch wrapper's auth behaviour - refresh on 401, retry, and sign-out on failure.
import { apiClient, ApiError, refreshSession, unwrapEnvelope } from '../apiClient';
import { mockFetch, callsTo, deferred, MockReply } from '@/test/utils';

const CACHE_KEY = 'qashio-query-cache';

describe('apiClient', () => {
  const assign = jest.fn();
  const originalLocation = window.location;

  beforeAll(() => {
    // jsdom can't navigate; swap location for a spy-able stand-in.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/transactions', assign },
    });
  });
  afterAll(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
  beforeEach(() => {
    assign.mockClear();
    localStorage.clear();
  });

  it('prefixes /api, sends JSON and parses the response', async () => {
    const fetchMock = mockFetch({ 'POST /api/things': { status: 201, body: { id: 1 } } });

    const result = await apiClient.post('/things', { name: 'a' });

    expect(result).toEqual({ id: 1 });
    const init = fetchMock.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.credentials).toBe('same-origin');
    expect(callsTo(fetchMock, 'POST', '/api/things')).toEqual([{ name: 'a' }]);
  });

  it('adds query params, skipping empty values', async () => {
    const fetchMock = mockFetch({ 'GET /api/things': { body: [] } });

    await apiClient.get('/things', { params: { page: 2, search: '', status: undefined, active: true } });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things?page=2&active=true');
  });

  it('unwraps the NestJS { success, data } envelope', async () => {
    mockFetch({ 'GET /api/users/me': { body: { success: true, data: { id: 'u1' }, timestamp: 'x' } } });

    expect(await apiClient.get('/users/me')).toEqual({ id: 'u1' });
  });

  it('keeps paginated responses as they are', () => {
    const page = { success: true, data: [1], pagination: { page: 1 } };
    expect(unwrapEnvelope(page)).toBe(page);
  });

  it('throws ApiError with the server message and field details', async () => {
    mockFetch({
      'POST /api/things': {
        status: 400,
        body: { error: { message: 'Invalid input', details: [{ field: 'name', message: 'Required' }] } },
      },
    });

    const error = await apiClient.post('/things', {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Invalid input', status: 400, details: [{ field: 'name', message: 'Required' }] });
  });

  describe('expired access token (401)', () => {
    it('refreshes the session once, then retries the original request', async () => {
      let meCalls = 0;
      const fetchMock = mockFetch({
        'GET /api/users/me': () => (++meCalls === 1 ? { status: 401, body: {} } : { body: { id: 'u1' } }),
        'POST /api/auth/refresh': { body: { success: true } },
      });

      const result = await apiClient.get('/users/me');

      expect(result).toEqual({ id: 'u1' });
      expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(1);
      expect(meCalls).toBe(2);
      expect(assign).not.toHaveBeenCalled();
    });

    it('shares one refresh between requests that fail at the same time', async () => {
      const refreshReply = deferred<MockReply>();
      const seen = new Map<string, number>();
      const firstCall401 = (key: string) => () => {
        seen.set(key, (seen.get(key) ?? 0) + 1);
        return seen.get(key) === 1 ? { status: 401, body: {} } : { body: key };
      };
      const fetchMock = mockFetch({
        'GET /api/a': firstCall401('a'),
        'GET /api/b': firstCall401('b'),
        'GET /api/c': firstCall401('c'),
        'POST /api/auth/refresh': () => refreshReply.promise,
      });

      const requests = Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
      // Let all three hit their 401 before the refresh answers.
      await new Promise((r) => setTimeout(r, 0));
      refreshReply.resolve({ body: { success: true } });

      expect(await requests).toEqual(['a', 'b', 'c']);
      // A refresh token is single-use: a second parallel refresh would fail.
      expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(1);
    });

    it('signs out when the refresh fails: clears cached data and goes to /login', async () => {
      localStorage.setItem(CACHE_KEY, '{"cached":"transactions"}');
      mockFetch({
        'GET /api/transactions': { status: 401, body: { error: { message: 'Unauthorized' } } },
        'POST /api/auth/refresh': { status: 401, body: {} },
      });

      await expect(apiClient.get('/transactions')).rejects.toMatchObject({ status: 401 });

      expect(assign).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('does not retry forever when the retried request is also 401', async () => {
      const fetchMock = mockFetch({
        'GET /api/transactions': { status: 401, body: {} },
        'POST /api/auth/refresh': { body: { success: true } },
      });

      await expect(apiClient.get('/transactions')).rejects.toBeInstanceOf(ApiError);

      expect(callsTo(fetchMock, 'GET', '/api/transactions')).toHaveLength(2);
      expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(1);
    });

    it('skipAuthRefresh: a 401 is just an error (e.g. wrong password on login)', async () => {
      const fetchMock = mockFetch({
        'POST /api/auth/login': { status: 401, body: { error: { message: 'Invalid email or password' } } },
      });

      await expect(apiClient.post('/auth/login', {}, { skipAuthRefresh: true })).rejects.toMatchObject({
        message: 'Invalid email or password',
      });

      expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(0);
      expect(assign).not.toHaveBeenCalled();
    });
  });

  it('refreshSession resolves false instead of throwing on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(refreshSession()).resolves.toBe(false);
  });
});
