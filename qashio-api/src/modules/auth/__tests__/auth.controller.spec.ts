import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
  const tokens = { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer' as const, expiresIn: '15m' };
  const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };
  const req = (cookies: Record<string, string> = {}) => ({ cookies }) as unknown as Request;
  const cookieNames = (mock: jest.Mock) => mock.mock.calls.map(([name]) => name);

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('POST /auth/register sets the auth cookies and returns only the user', async () => {
    authService.register.mockResolvedValue({ user: { id: 'user-1' }, tokens });
    const dto = { email: 'demo@qashio.com', password: 'Secret123', firstName: 'Demo', lastName: 'User' };
    const response = res();

    await expect(controller.register(dto, response)).resolves.toEqual({ user: { id: 'user-1' } });
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(cookieNames(response.cookie)).toEqual(['token', 'refreshToken', 'rememberMe']);
  });

  it('POST /auth/login without rememberMe sets session cookies', async () => {
    authService.login.mockResolvedValue({ user: { id: 'user-1' }, tokens });
    const response = res();

    await expect(
      controller.login({ email: 'demo@qashio.com', password: 'Secret123' }, response),
    ).resolves.toEqual({ user: { id: 'user-1' } });
    expect(authService.login).toHaveBeenCalledWith({ email: 'demo@qashio.com', password: 'Secret123' });
    expect(response.cookie).toHaveBeenCalledWith('token', 'a', expect.objectContaining({ httpOnly: true, maxAge: undefined }));
    expect(cookieNames(response.clearCookie)).toEqual(['rememberMe']);
  });

  it('POST /auth/login with rememberMe also sets the rememberMe cookie', async () => {
    authService.login.mockResolvedValue({ user: { id: 'user-1' }, tokens });
    const response = res();

    await controller.login({ email: 'demo@qashio.com', password: 'Secret123', rememberMe: true }, response);
    expect(cookieNames(response.cookie)).toContain('rememberMe');
  });

  it('POST /auth/refresh swaps the refresh token cookie for a new pair', async () => {
    authService.refresh.mockResolvedValue(tokens);
    const response = res();

    await controller.refresh(req({ refreshToken: 'old' }), response);
    expect(authService.refresh).toHaveBeenCalledWith('old');
    expect(cookieNames(response.cookie)).toEqual(['token', 'refreshToken']);
  });

  it('POST /auth/refresh without a cookie is 401 and clears the cookies', async () => {
    const response = res();

    await expect(controller.refresh(req(), response)).rejects.toThrow(UnauthorizedException);
    expect(authService.refresh).not.toHaveBeenCalled();
    expect(cookieNames(response.clearCookie)).toEqual(['token', 'refreshToken', 'rememberMe']);
  });

  it('POST /auth/logout revokes the refresh token and clears the cookies', async () => {
    const response = res();

    await controller.logout(req({ refreshToken: 'r' }), response);
    expect(authService.revokeRefreshToken).toHaveBeenCalledWith('r');
    expect(cookieNames(response.clearCookie)).toEqual(['token', 'refreshToken', 'rememberMe']);
  });

  it('all auth routes are public', () => {
    const isPublic = (method: keyof AuthController) =>
      Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype[method]) === true;

    for (const method of ['register', 'login', 'refresh', 'logout'] as const) {
      expect(isPublic(method)).toBe(true);
    }
  });
});
