import { Test } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = { register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
  const tokens = { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer' as const, expiresIn: '15m' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('POST /auth/register returns the user and tokens', async () => {
    const result = { user: { id: 'user-1' }, tokens };
    authService.register.mockResolvedValue(result);
    const dto = { email: 'demo@qashio.com', password: 'Secret123', firstName: 'Demo', lastName: 'User' };

    await expect(controller.register(dto)).resolves.toBe(result);
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('POST /auth/login returns the user and tokens', async () => {
    const result = { user: { id: 'user-1' }, tokens };
    authService.login.mockResolvedValue(result);
    const dto = { email: 'demo@qashio.com', password: 'Secret123' };

    await expect(controller.login(dto)).resolves.toBe(result);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('POST /auth/refresh swaps the refresh token for a new pair', async () => {
    authService.refresh.mockResolvedValue(tokens);

    await expect(controller.refresh({ refreshToken: 'old' })).resolves.toBe(tokens);
    expect(authService.refresh).toHaveBeenCalledWith('old');
  });

  it('POST /auth/logout signs out the current user', async () => {
    authService.logout.mockResolvedValue(undefined);

    await expect(controller.logout('user-1')).resolves.toBeUndefined();
    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });

  it('register, login and refresh are public; logout needs a token', () => {
    const isPublic = (method: keyof AuthController) =>
      Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype[method]) === true;

    expect(isPublic('register')).toBe(true);
    expect(isPublic('login')).toBe(true);
    expect(isPublic('refresh')).toBe(true);
    expect(isPublic('logout')).toBe(false);
  });
});
