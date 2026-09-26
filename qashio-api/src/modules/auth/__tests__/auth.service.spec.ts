import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword } from '@/common/helpers/hash.helper';
import { JwtPayload, TokenType } from '@/modules/auth/interfaces/jwt-payload.interface';
import { AuthService } from '@/modules/auth/auth.service';
import { User } from '@/modules/users/entities/users.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { UsersService } from '@/modules/users/users.service';

const jwtConfig = { secret: 'test-secret', accessExpiresIn: '15m', refreshExpiresIn: '7d' } as const;

const createUsersService = (user: User) => {
  const store = { refreshTokenHash: null as string | null };
  const service = {
    create: jest.fn(async () => user),
    findByEmailWithPassword: jest.fn(async (email: string) => (email === user.email ? user : null)),
    findByIdWithRefreshToken: jest.fn(async (id: string) =>
      id === user.id ? Object.assign(new User(), user, { refreshTokenHash: store.refreshTokenHash }) : null,
    ),
    setRefreshTokenHash: jest.fn(async (_id: string, hash: string | null) => {
      store.refreshTokenHash = hash;
    }),
  };
  return { service, store };
};

describe('AuthService', () => {
  let user: User;
  let jwtService: JwtService;
  let users: ReturnType<typeof createUsersService>;
  let auth: AuthService;

  beforeAll(async () => {
    user = Object.assign(new User(), {
      id: 'user-1',
      email: 'jehad@example.com',
      firstName: 'Jehad',
      lastName: 'Hlewi',
      role: UserRole.USER,
      passwordHash: await hashPassword('StrongPass123'),
    });
  });

  beforeEach(() => {
    jwtService = new JwtService({ secret: jwtConfig.secret });
    users = createUsersService(user);
    auth = new AuthService(users.service as unknown as UsersService, jwtService, jwtConfig as never);
  });

  it('register creates the user and returns an access + refresh token pair', async () => {
    const dto = { email: user.email, password: 'StrongPass123', firstName: 'Jehad', lastName: 'Hlewi' };
    const { tokens } = await auth.register(dto);

    expect(users.service.create).toHaveBeenCalledWith(dto);
    const access = jwtService.verify<JwtPayload>(tokens.accessToken);
    const refresh = jwtService.verify<JwtPayload>(tokens.refreshToken);
    expect(access).toMatchObject({ sub: user.id, role: UserRole.USER, type: TokenType.ACCESS });
    expect(refresh).toMatchObject({ sub: user.id, type: TokenType.REFRESH });
    expect(tokens.expiresIn).toBe('15m');
    // Stored as a SHA-256 hex digest, never the raw token.
    expect(users.store.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('login succeeds with the right password', async () => {
    const res = await auth.login({ email: user.email, password: 'StrongPass123' });
    expect(res.user.id).toBe(user.id);
  });

  it.each([
    ['wrong password', 'jehad@example.com', 'WrongPass123'],
    ['unknown email', 'nobody@example.com', 'StrongPass123'],
  ])('login rejects %s with the same message', async (_case, email, password) => {
    await expect(auth.login({ email, password })).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('refresh rotates tokens: the old refresh token stops working', async () => {
    const { tokens } = await auth.login({ email: user.email, password: 'StrongPass123' });

    const rotated = await auth.refresh(tokens.refreshToken);
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    expect(users.store.refreshTokenHash).toBeNull();
    await expect(auth.refresh(rotated.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('refresh rejects an access token', async () => {
    const { tokens } = await auth.login({ email: user.email, password: 'StrongPass123' });
    await expect(auth.refresh(tokens.accessToken)).rejects.toThrow('Invalid token type');
  });

  it('refresh rejects a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'other' }).sign({ sub: user.id, type: TokenType.REFRESH });
    await expect(auth.refresh(forged)).rejects.toThrow('Invalid or expired refresh token');
  });

  it('logout revokes the refresh token', async () => {
    const { tokens } = await auth.login({ email: user.email, password: 'StrongPass123' });
    await auth.logout(user.id);
    await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
