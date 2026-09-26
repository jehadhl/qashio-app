// lib/auth/session.ts - server-side helpers for the /api/auth routes: call the NestJS
// auth endpoints and keep the returned tokens in httpOnly cookies.
import { NextResponse } from 'next/server';
import { backendUrl } from '@/lib/api/backend';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REMEMBER_ME_COOKIE } from '@/lib/auth/cookies';

const TIMEOUT_MS = 5000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type AuthErrorCode = 'UNAUTHORIZED' | 'BAD_GATEWAY' | 'BACKEND_ERROR';

export const authError = (status: number, code: AuthErrorCode, message: string) =>
  NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );

type BackendResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };


export async function callAuthBackend<T>(
  path: string,
  body?: unknown,
  accessToken?: string
): Promise<BackendResult<T>> {
  const base = backendUrl();
  if (!base) {
    return {
      ok: false,
      response: authError(503, 'BAD_GATEWAY', 'Sign-in needs the NestJS API (set BACKEND_API_URL)'),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${base}/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`NestJS auth API unreachable (${base}/auth/${path}):`, error);
    return { ok: false, response: authError(502, 'BAD_GATEWAY', 'Backend API is unavailable') };
  }

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    // NestJS sends validation errors as an array of messages.
    const message = Array.isArray(json?.message) ? json.message.join('. ') : json?.message;
    const code = response.status === 401 ? 'UNAUTHORIZED' : 'BACKEND_ERROR';
    return {
      ok: false,
      response: authError(response.status, code, message ?? `Auth request failed (${response.status})`),
    };
  }

  return { ok: true, data: json?.data as T };
}

// Seconds until the JWT's `exp`, so each cookie lives exactly as long as its token.
// The token is not verified here - NestJS does that - it only sets the cookie lifetime.
const secondsUntilExpiry = (jwt: string): number | undefined => {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    return typeof payload.exp === 'number'
      ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
      : undefined;
  } catch {
    return undefined;
  }
};

const cookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

// persistent=false gives session cookies (no maxAge): the browser drops them on close.
export function setAuthCookies(response: NextResponse, tokens: AuthTokens, persistent = true) {
  const lifetime = (jwt: string) => (persistent ? secondsUntilExpiry(jwt) : undefined);
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions(lifetime(tokens.accessToken)));
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions(lifetime(tokens.refreshToken)));
  if (persistent) {
    response.cookies.set(REMEMBER_ME_COOKIE, '1', cookieOptions(secondsUntilExpiry(tokens.refreshToken)));
  } else {
    response.cookies.set(REMEMBER_ME_COOKIE, '', cookieOptions(0));
  }
  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', cookieOptions(0));
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', cookieOptions(0));
  response.cookies.set(REMEMBER_ME_COOKIE, '', cookieOptions(0));
  return response;
}
