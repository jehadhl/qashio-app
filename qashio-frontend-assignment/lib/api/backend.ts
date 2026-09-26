import { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

// The browser always calls this app's own /api/* routes. When BACKEND_API_URL is
// set (e.g. http://localhost:4000/api, or http://qashio-api:4000/api in docker), those
// routes forward the request to the real NestJS API; otherwise - or while that
// API is unreachable - the local mock handlers (lowdb) answer instead.
//
// Read at request time rather than build time, so one Docker image works for both.
export const backendUrl = () => process.env.BACKEND_API_URL?.trim().replace(/\/+$/, '') || null;


const fallbackEnabled = () => process.env.BACKEND_FALLBACK !== 'false';

const TIMEOUT_MS = 5000;


const RETRY_AFTER_MS = 30_000;
let backendDownUntil = 0;


const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'authorization'];


const PROXY_HOP_HEADER = 'x-qashio-proxied';

export type ApiSource = 'nest' | 'mock';


const REQUEST_ERROR_NAMES = new Set(['TypeError', 'TimeoutError', 'AbortError']);
const isRequestError = (error: unknown) =>
  typeof error === 'object' && error !== null && REQUEST_ERROR_NAMES.has((error as Error).name);


const backendError = (status: 502 | 503, message: string) =>
  Response.json(
    { success: false, error: { code: status === 502 ? 'BAD_GATEWAY' : 'SERVICE_UNAVAILABLE', message } },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Api-Source': 'nest' satisfies ApiSource } }
  );

// A signed-in user's data lives in NestJS only: the mock (data/db.json) is demo data
// for building the UI, and must never be shown in place of their real transactions.
const isSignedIn = (request: NextRequest) =>
  request.cookies.has(ACCESS_TOKEN_COOKIE) || request.cookies.has(REFRESH_TOKEN_COOKIE);

// Forwards to NestJS. Returns null when the mock should answer instead, which is
// only allowed when `allowMock` is true.
async function proxyToBackend(request: NextRequest, allowMock: boolean): Promise<Response | null> {
  const base = backendUrl();
  if (!base) {
    return allowMock ? null : backendError(503, 'Backend API is not configured (set BACKEND_API_URL)');
  }
  if (request.headers.has(PROXY_HOP_HEADER)) {
    console.error(`BACKEND_API_URL (${base}) points at this Next.js app; using the mock API.`);
    return allowMock ? null : backendError(502, 'Backend API is misconfigured');
  }
  if (allowMock && Date.now() < backendDownUntil) return null;

  const { pathname, search } = request.nextUrl;
  const target = `${base}${pathname.replace(/^\/api/, '')}${search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  headers.set(PROXY_HOP_HEADER, '1');

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
        'X-Api-Source': 'nest' satisfies ApiSource,
      },
    });
  } catch (error) {
    if (!isRequestError(error)) throw error;

    if (!allowMock) {
      console.error(`NestJS API unreachable (${target}):`, error);
      return backendError(502, 'Backend API is unavailable');
    }

    console.warn(
      `NestJS API unreachable at ${base}; using the mock API for the next ${RETRY_AFTER_MS / 1000}s.`
    );
    backendDownUntil = Date.now() + RETRY_AFTER_MS;
    return null;
  }
}

// Wraps a mock route handler so it only runs when the request isn't sent to NestJS.
export function withBackend<Context>(
  handler: (request: NextRequest, context: Context) => Promise<Response>
) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    const allowMock = fallbackEnabled() && !isSignedIn(request);
    const proxied = await proxyToBackend(request, allowMock);
    if (proxied) return proxied;

    const response = await handler(request, context);
    response.headers.set('X-Api-Source', 'mock' satisfies ApiSource);
    return response;
  };
}
