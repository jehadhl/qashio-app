import { NextRequest } from 'next/server';
import { startFakeNest, FakeNest } from '@/test/fakeNest';

type WithBackend = typeof import('../backend').withBackend;

const mockHandler = jest.fn(async () => Response.json({ from: 'mock' }));

// Fresh module per test so the "backend down" timer doesn't leak between tests.
const loadWithBackend = (): WithBackend => {
  let fn!: WithBackend;
  jest.isolateModules(() => {
    fn = require('../backend').withBackend;
  });
  return fn;
};

const call = (withBackend: WithBackend, url: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  withBackend(mockHandler)(new NextRequest(url, init), {});

describe('withBackend', () => {
  // Stands in for the NestJS API.
  let nest: FakeNest;

  beforeAll(async () => {
    nest = await startFakeNest();
  });

  afterAll(() => nest.close());

  beforeEach(() => {
    nest.reset();
    mockHandler.mockClear();
    delete process.env.BACKEND_API_URL;
    delete process.env.BACKEND_FALLBACK;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the mock handler when BACKEND_API_URL is not set', async () => {
    const res = await call(loadWithBackend(), 'http://localhost/api/transactions');

    expect(await res.json()).toEqual({ from: 'mock' });
    expect(res.headers.get('x-api-source')).toBe('mock');
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('forwards to NestJS without the /api prefix, keeping method, query and body', async () => {
    process.env.BACKEND_API_URL = `${nest.url}/`;
    nest.respond(201, { from: 'nest' });

    const res = await call(loadWithBackend(), 'http://localhost/api/transactions?page=2&category=Rent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 10 }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ from: 'nest' });
    expect(res.headers.get('x-api-source')).toBe('nest');
    expect(nest.requests).toHaveLength(1);
    expect(nest.requests[0]).toMatchObject({
      method: 'POST',
      url: '/transactions?page=2&category=Rent',
      body: { amount: 10 },
      headers: expect.objectContaining({ 'content-type': 'application/json' }),
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('falls back to the mock handler when NestJS is unreachable', async () => {
    process.env.BACKEND_API_URL = await nest.closedUrl();

    const withBackend = loadWithBackend();
    const res = await call(withBackend, 'http://localhost/api/categories');

    expect(await res.json()).toEqual({ from: 'mock' });
    expect(res.headers.get('x-api-source')).toBe('mock');

    // Skips the dead backend on the next request instead of waiting again.
    await call(withBackend, 'http://localhost/api/categories');
    expect(mockHandler).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('does not forward a request that was already forwarded (proxy loop)', async () => {
    process.env.BACKEND_API_URL = nest.url;

    const res = await call(loadWithBackend(), 'http://localhost/api/categories', {
      headers: { 'x-qashio-proxied': '1' },
    });

    expect(await res.json()).toEqual({ from: 'mock' });
    expect(nest.requests).toEqual([]);
  });

  it('never serves mock data to a signed-in user: 502 when NestJS is down', async () => {
    process.env.BACKEND_API_URL = await nest.closedUrl();

    const res = await call(loadWithBackend(), 'http://localhost/api/transactions', {
      headers: { cookie: 'token=abc' },
    });

    expect(res.status).toBe(502);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('never serves mock data to a signed-in user: 503 when no backend is configured', async () => {
    const res = await call(loadWithBackend(), 'http://localhost/api/transactions', {
      headers: { cookie: 'refreshToken=abc' },
    });

    expect(res.status).toBe(503);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('sends the access token cookie to NestJS as a Bearer token', async () => {
    process.env.BACKEND_API_URL = nest.url;

    await call(loadWithBackend(), 'http://localhost/api/transactions', {
      headers: { cookie: 'token=abc' },
    });

    expect(nest.requests[0].headers.authorization).toBe('Bearer abc');
  });

  it('returns 502 instead of falling back when BACKEND_FALLBACK=false', async () => {
    process.env.BACKEND_API_URL = await nest.closedUrl();
    process.env.BACKEND_FALLBACK = 'false';

    const res = await call(loadWithBackend(), 'http://localhost/api/categories');

    expect(res.status).toBe(502);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
