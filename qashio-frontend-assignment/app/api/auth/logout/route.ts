// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { callAuthBackend, clearAuthCookies } from '@/lib/auth/session';

// POST /api/auth/logout - revokes the refresh token in NestJS (best effort) and
// always clears the cookies, so the user is signed out even if NestJS is down.
export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    await callAuthBackend('logout', undefined, accessToken);
  }

  return clearAuthCookies(
    NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  );
}
