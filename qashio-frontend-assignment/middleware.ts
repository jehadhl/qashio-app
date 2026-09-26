import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The access token cookie expires with the token. A refresh token still counts
  // as signed in: the api client renews the session on its first 401.
  const hasToken = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  );
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  // Signed in: keep them out of login/register.
  if (hasToken && isAuthPage) {
    return NextResponse.redirect(new URL('/transactions', request.url));
  }

  // Signed out: every other page needs a token.
  if (!hasToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
