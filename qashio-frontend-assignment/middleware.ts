import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

const AUTH_PAGES = ['/login', '/register'];


export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  // Signed out: the login page first; nothing else is reachable.
  if (!signedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Signed in: skip login/register, and "/" goes to the app.
  if (signedIn && (isAuthPage || pathname === '/')) {
    return NextResponse.redirect(new URL('/transactions', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
