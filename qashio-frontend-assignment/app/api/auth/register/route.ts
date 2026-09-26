// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BodyError, readJsonBody } from '@/lib/api/http';
import { AuthTokens, callAuthBackend, setAuthCookies } from '@/lib/auth/session';

// POST /api/auth/register - forwards to NestJS, stores the tokens in httpOnly cookies
// and returns only the user, so the tokens never reach page JavaScript.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof BodyError) return error.response;
    throw error;
  }

  const result = await callAuthBackend<{ user: unknown; tokens: AuthTokens }>('register', body);
  if (!result.ok) return result.response;

  const { user, tokens } = result.data;
  return setAuthCookies(
    NextResponse.json({ user }, { status: 201, headers: { 'Cache-Control': 'no-store' } }),
    tokens
  );
}
