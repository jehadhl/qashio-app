// Integration: the real /api/auth route handlers talking to a fake NestJS over HTTP.
import { NextRequest } from 'next/server';
import { POST as login } from '../login/route';
import { POST as register } from '../register/route';
import { POST as refresh } from '../refresh/route';
import { POST as logout } from '../logout/route';
import { fakeJwt, startFakeNest, FakeNest } from '@/test/fakeNest';

const user = { id: 'user-1', email: 'demo@qashio.com', firstName: 'Demo', lastName: 'User', role: 'user' };
const tokenPair = () => ({
  accessToken: fakeJwt(15 * 60),
  refreshToken: fakeJwt(7 * 24 * 60 * 60),
  tokenType: 'Bearer',
  expiresIn: '15m',
});

const post = (path: string, body?: unknown, cookies: Record<string, string> = {}) => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

// Set-Cookie headers as { name: { value, maxAge } }.
const setCookies = (response: Response) => {
  const result: Record<string, { value: string; maxAge?: number; httpOnly: boolean }> = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair, ...attrs] = header.split(';').map((part) => part.trim());
    const [name, ...value] = pair.split('=');
    const maxAge = attrs.find((a) => a.toLowerCase().startsWith('max-age='));
    result[name] = {
      value: value.join('='),
      maxAge: maxAge ? Number(maxAge.split('=')[1]) : undefined,
      httpOnly: attrs.some((a) => a.toLowerCase() === 'httponly'),
    };
  }
  return result;
};

describe('/api/auth routes', () => {
  let nest: FakeNest;

  beforeAll(async () => {
    nest = await startFakeNest();
  });
  afterAll(() => nest.close());
  beforeEach(() => {
    nest.reset();
    process.env.BACKEND_API_URL = nest.url;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.BACKEND_API_URL;
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('logs in, sets httpOnly token cookies and returns only the user', async () => {
      const tokens = tokenPair();
      nest.respond(200, { success: true, data: { user, tokens } });

      const res = await login(post('/api/auth/login', { email: user.email, password: 'Secret123', rememberMe: true }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ user });
      expect(JSON.stringify(body)).not.toContain(tokens.accessToken);

      const cookies = setCookies(res);
      expect(cookies.token).toMatchObject({ value: tokens.accessToken, httpOnly: true });
      expect(cookies.refreshToken).toMatchObject({ value: tokens.refreshToken, httpOnly: true });
      expect(cookies.token.maxAge).toBeGreaterThan(0);
      expect(cookies.rememberMe.value).toBe('1');
    });

    it('does not forward rememberMe to NestJS (it rejects unknown fields)', async () => {
      nest.respond(200, { success: true, data: { user, tokens: tokenPair() } });

      await login(post('/api/auth/login', { email: user.email, password: 'Secret123', rememberMe: true }));

      expect(nest.requests[0]).toMatchObject({
        url: '/auth/login',
        body: { email: user.email, password: 'Secret123' },
      });
    });

    it('uses session cookies when "Remember me" is off', async () => {
      nest.respond(200, { success: true, data: { user, tokens: tokenPair() } });

      const res = await login(post('/api/auth/login', { email: user.email, password: 'Secret123' }));

      const cookies = setCookies(res);
      expect(cookies.token.maxAge).toBeUndefined();
      expect(cookies.refreshToken.maxAge).toBeUndefined();
      expect(cookies.rememberMe.maxAge).toBe(0);
    });

    it('passes wrong-credential errors through and sets no tokens', async () => {
      nest.respond(401, { success: false, statusCode: 401, message: 'Invalid email or password' });

      const res = await login(post('/api/auth/login', { email: user.email, password: 'wrong' }));

      expect(res.status).toBe(401);
      expect((await res.json()).error.message).toBe('Invalid email or password');
      expect(setCookies(res).token).toBeUndefined();
    });

    it('rejects a non-JSON body before calling NestJS', async () => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });

      const res = await login(req);

      expect(res.status).toBe(415);
      expect(nest.requests).toHaveLength(0);
    });

    it('returns 502 when NestJS is down', async () => {
      process.env.BACKEND_API_URL = await nest.closedUrl();

      const res = await login(post('/api/auth/login', { email: user.email, password: 'x' }));

      expect(res.status).toBe(502);
    });
  });

  describe('POST /api/auth/register', () => {
    const payload = { firstName: 'Demo', lastName: 'User', email: user.email, password: 'Secret123' };

    it('creates the account, signs the user in and returns 201 with the user', async () => {
      const tokens = tokenPair();
      nest.respond(201, { success: true, data: { user, tokens } });

      const res = await register(post('/api/auth/register', payload));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ user });
      expect(nest.requests[0]).toMatchObject({ url: '/auth/register', body: payload });
      expect(setCookies(res).token.value).toBe(tokens.accessToken);
    });

    it('passes a duplicate-email conflict through', async () => {
      nest.respond(409, { success: false, statusCode: 409, message: 'Email is already registered' });

      const res = await register(post('/api/auth/register', payload));

      expect(res.status).toBe(409);
      expect((await res.json()).error.message).toBe('Email is already registered');
      expect(setCookies(res).token).toBeUndefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('swaps the refresh cookie for a new token pair', async () => {
      const oldRefresh = fakeJwt(60);
      const tokens = tokenPair();
      nest.respond(200, { success: true, data: tokens });

      const res = await refresh(post('/api/auth/refresh', undefined, { refreshToken: oldRefresh, rememberMe: '1' }));

      expect(res.status).toBe(200);
      expect(nest.requests[0]).toMatchObject({ url: '/auth/refresh', body: { refreshToken: oldRefresh } });
      const cookies = setCookies(res);
      expect(cookies.token.value).toBe(tokens.accessToken);
      expect(cookies.refreshToken.value).toBe(tokens.refreshToken);
      // Remembered sessions stay persistent across refreshes.
      expect(cookies.token.maxAge).toBeGreaterThan(0);
    });

    it('keeps session cookies for a session that was not remembered', async () => {
      nest.respond(200, { success: true, data: tokenPair() });

      const res = await refresh(post('/api/auth/refresh', undefined, { refreshToken: fakeJwt(60) }));

      expect(setCookies(res).token.maxAge).toBeUndefined();
    });

    it('returns 401 and clears cookies when there is no refresh cookie', async () => {
      const res = await refresh(post('/api/auth/refresh'));

      expect(res.status).toBe(401);
      expect(nest.requests).toHaveLength(0);
      expect(setCookies(res).token.maxAge).toBe(0);
    });

    it('ends the session when NestJS rejects the refresh token (expired or reused)', async () => {
      nest.respond(401, { success: false, statusCode: 401, message: 'Invalid refresh token' });

      const res = await refresh(post('/api/auth/refresh', undefined, { refreshToken: fakeJwt(60) }));

      expect(res.status).toBe(401);
      const cookies = setCookies(res);
      expect(cookies.token).toMatchObject({ value: '', maxAge: 0 });
      expect(cookies.refreshToken).toMatchObject({ value: '', maxAge: 0 });
    });

    it('keeps the cookies when NestJS is merely unreachable', async () => {
      process.env.BACKEND_API_URL = await nest.closedUrl();

      const res = await refresh(post('/api/auth/refresh', undefined, { refreshToken: fakeJwt(60) }));

      expect(res.status).toBe(502);
      expect(setCookies(res).refreshToken).toBeUndefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the session in NestJS with the Bearer token and clears every cookie', async () => {
      nest.respond(204);

      const res = await logout(post('/api/auth/logout', undefined, { token: 'access-abc', refreshToken: 'r' }));

      expect(res.status).toBe(200);
      expect(nest.requests[0]).toMatchObject({ url: '/auth/logout' });
      expect(nest.requests[0].headers.authorization).toBe('Bearer access-abc');
      const cookies = setCookies(res);
      for (const name of ['token', 'refreshToken', 'rememberMe']) {
        expect(cookies[name]).toMatchObject({ value: '', maxAge: 0 });
      }
    });

    it('still signs the user out when NestJS is down', async () => {
      process.env.BACKEND_API_URL = await nest.closedUrl();

      const res = await logout(post('/api/auth/logout', undefined, { token: 'access-abc' }));

      expect(res.status).toBe(200);
      expect(setCookies(res).token.maxAge).toBe(0);
    });

    it('skips NestJS when there is no access token', async () => {
      const res = await logout(post('/api/auth/logout'));

      expect(res.status).toBe(200);
      expect(nest.requests).toHaveLength(0);
    });
  });
});
