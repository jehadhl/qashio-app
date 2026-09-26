// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_TOKEN_COOKIE, REMEMBER_ME_COOKIE } from '@/lib/auth/cookies';
import { AuthTokens, authError, callAuthBackend, clearAuthCookies, setAuthCookies } from '@/lib/auth/session';

// POST /api/auth/refresh - swaps the refresh token cookie for a new token pair.
// Refresh tokens are single-use in NestJS, so both cookies are replaced.
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return clearAuthCookies(authError(401, 'UNAUTHORIZED', 'No refresh token'));
  }

  const result = await callAuthBackend<AuthTokens>('refresh', { refreshToken });
  if (!result.ok) {
    // Expired, reused or revoked: the session is over.
    return result.response.status === 401 ? clearAuthCookies(result.response) : result.response;
  }

  return setAuthCookies(
    NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } }),
    result.data,
    request.cookies.has(REMEMBER_ME_COOKIE)
  );
}
