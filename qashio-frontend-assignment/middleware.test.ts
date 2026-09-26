import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const visit = (path: string, cookies: Record<string, string> = {}) => {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return middleware(new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }));
};

const redirectTarget = (response: Response) => {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
};

describe('middleware (route guard)', () => {
  describe('signed out', () => {
    it.each(['/transactions', '/transactions/new', '/profile', '/'])('sends %s to /login', (path) => {
      expect(redirectTarget(visit(path))).toBe('/login');
    });

    it.each(['/login', '/register'])('lets %s through', (path) => {
      expect(redirectTarget(visit(path))).toBeNull();
    });
  });

  describe('signed in', () => {
    it.each(['/login', '/register'])('sends %s to /transactions', (path) => {
      expect(redirectTarget(visit(path, { refreshToken: 'abc' }))).toBe('/transactions');
    });

    it('lets protected pages through', () => {
      expect(redirectTarget(visit('/transactions', { refreshToken: 'abc' }))).toBeNull();
    });

    it('counts a refresh token alone as signed in (access token cookie expired)', () => {
      expect(redirectTarget(visit('/transactions', { refreshToken: 'abc' }))).toBeNull();
      expect(redirectTarget(visit('/login', { refreshToken: 'abc' }))).toBe('/transactions');
    });

    it('ignores empty cookie values', () => {
      expect(redirectTarget(visit('/transactions', { token: '' }))).toBe('/login');
    });
  });
});
