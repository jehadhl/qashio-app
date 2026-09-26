import type { CookieOptions, Request, Response } from 'express';
import { AuthTokensDto } from '@/modules/auth/dto/auth-response.dto';

export const ACCESS_TOKEN_COOKIE = 'token';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
export const REMEMBER_ME_COOKIE = 'rememberMe';

// Express types req.cookies as any; cookie-parser only ever sets string values.
export const readCookie = (
  req: Request | undefined,
  name: string,
): string | undefined => {
  const value: unknown = (
    req?.cookies as Record<string, unknown> | undefined
  )?.[name];
  return typeof value === 'string' ? value : undefined;
};

const msUntilExpiry = (jwt: string): number | undefined => {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1], 'base64url').toString(),
    ) as { exp?: unknown };
    return typeof payload.exp === 'number'
      ? Math.max(0, payload.exp * 1000 - Date.now())
      : undefined;
  } catch {
    return undefined;
  }
};

const cookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge,
});

// persistent=false gives session cookies (no maxAge): the browser drops them on close.
export function setAuthCookies(
  res: Response,
  tokens: AuthTokensDto,
  persistent: boolean,
): void {
  const lifetime = (jwt: string) =>
    persistent ? msUntilExpiry(jwt) : undefined;
  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions(lifetime(tokens.accessToken)),
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions(lifetime(tokens.refreshToken)),
  );
  if (persistent) {
    res.cookie(
      REMEMBER_ME_COOKIE,
      '1',
      cookieOptions(msUntilExpiry(tokens.refreshToken)),
    );
  } else {
    res.clearCookie(REMEMBER_ME_COOKIE, cookieOptions());
  }
}

export function clearAuthCookies(res: Response): void {
  for (const name of [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    REMEMBER_ME_COOKIE,
  ]) {
    res.clearCookie(name, cookieOptions());
  }
}
