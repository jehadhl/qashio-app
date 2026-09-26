import { NextResponse } from 'next/server';
import { callAuthBackend, clearAuthCookies, setAuthCookies } from '../session';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REMEMBER_ME_COOKIE } from '../cookies';
import { fakeJwt, startFakeNest, FakeNest } from '../../../test/fakeNest';

const cookie = (response: NextResponse, name: string) => response.cookies.get(name);

describe('setAuthCookies', () => {
  const tokens = { accessToken: fakeJwt(15 * 60), refreshToken: fakeJwt(7 * 24 * 60 * 60) };

  it('stores both tokens as httpOnly cookies that live as long as each token', () => {
    const response = setAuthCookies(NextResponse.json({}), tokens);

    const access = cookie(response, ACCESS_TOKEN_COOKIE)!;
    const refresh = cookie(response, REFRESH_TOKEN_COOKIE)!;
    expect(access.value).toBe(tokens.accessToken);
    expect(refresh.value).toBe(tokens.refreshToken);
    expect(access).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    // Allow a second of drift between signing and checking.
    expect(access.maxAge).toBeGreaterThanOrEqual(15 * 60 - 1);
    expect(access.maxAge).toBeLessThanOrEqual(15 * 60);
    expect(refresh.maxAge).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 - 1);
  });

  it('marks the session as remembered by default', () => {
    const response = setAuthCookies(NextResponse.json({}), tokens);
    expect(cookie(response, REMEMBER_ME_COOKIE)?.value).toBe('1');
  });

  it('uses session cookies (no maxAge) when not remembered', () => {
    const response = setAuthCookies(NextResponse.json({}), tokens, false);

    expect(cookie(response, ACCESS_TOKEN_COOKIE)?.maxAge).toBeUndefined();
    expect(cookie(response, REFRESH_TOKEN_COOKIE)?.maxAge).toBeUndefined();
    expect(cookie(response, REMEMBER_ME_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });

  it('falls back to a session cookie when a token has no readable exp', () => {
    const response = setAuthCookies(NextResponse.json({}), {
      accessToken: 'not-a-jwt',
      refreshToken: tokens.refreshToken,
    });
    expect(cookie(response, ACCESS_TOKEN_COOKIE)?.maxAge).toBeUndefined();
  });
});

describe('clearAuthCookies', () => {
  it('expires every auth cookie', () => {
    const response = clearAuthCookies(NextResponse.json({}));

    for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REMEMBER_ME_COOKIE]) {
      expect(cookie(response, name)).toMatchObject({ value: '', maxAge: 0 });
    }
  });
});

describe('callAuthBackend', () => {
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

  it('returns 503 when no backend is configured', async () => {
    delete process.env.BACKEND_API_URL;

    const result = await callAuthBackend('login', {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
  });

  it('POSTs JSON to /auth/<path> and unwraps the { success, data } envelope', async () => {
    nest.respond(200, { success: true, data: { hello: 'world' } });

    const result = await callAuthBackend('login', { email: 'a@b.com' });

    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
    expect(nest.requests[0]).toMatchObject({
      method: 'POST',
      url: '/auth/login',
      body: { email: 'a@b.com' },
    });
  });

  it('sends the access token as a Bearer header when given', async () => {
    nest.respond(204);

    await callAuthBackend('logout', undefined, 'abc');

    expect(nest.requests[0].headers.authorization).toBe('Bearer abc');
  });

  it("turns NestJS errors into this app's { error: { code, message } } shape", async () => {
    nest.respond(401, { success: false, statusCode: 401, message: 'Invalid email or password' });

    const result = await callAuthBackend('login', {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
    });
  });

  it('joins validation messages that NestJS sends as an array', async () => {
    nest.respond(400, { message: ['email must be an email', 'password is too short'] });

    const result = await callAuthBackend('register', {});

    if (result.ok) throw new Error('expected failure');
    expect((await result.response.json()).error.message).toBe(
      'email must be an email. password is too short'
    );
  });

  it('returns 502 when NestJS is unreachable', async () => {
    process.env.BACKEND_API_URL = await nest.closedUrl();

    const result = await callAuthBackend('login', {});

    if (result.ok) throw new Error('expected failure');
    expect(result.response.status).toBe(502);
  });
});
