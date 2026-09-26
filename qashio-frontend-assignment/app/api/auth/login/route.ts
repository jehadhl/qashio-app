// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BodyError, readJsonBody } from '@/lib/api/http';
import { AuthTokens, callAuthBackend, setAuthCookies } from '@/lib/auth/session';

// POST /api/auth/login - forwards to NestJS, stores the tokens in httpOnly cookies
// and returns only the user, so the tokens never reach page JavaScript.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof BodyError) return error.response;
    throw error;
  }

  // rememberMe is ours, not NestJS's (which rejects unknown fields), so take it off.
  const { rememberMe, ...credentials } = (body ?? {}) as Record<string, unknown>;

  const result = await callAuthBackend<{ user: unknown; tokens: AuthTokens }>('login', credentials);
  if (!result.ok) return result.response;

  const { user, tokens } = result.data;
  return setAuthCookies(
    NextResponse.json({ user }, { status: 200, headers: { 'Cache-Control': 'no-store' } }),
    tokens,
    rememberMe === true
  );
}
