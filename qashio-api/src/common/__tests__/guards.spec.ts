import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { AuthUser } from '@/modules/auth/interfaces/auth-user.interface';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/modules/users/enums/user-role.enum';

const contextFor = (metadata: Record<string, unknown>, user?: AuthUser, type = 'http') => {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) Reflect.defineMetadata(key, value, handler);
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user, headers: {} }) }),
  } as unknown as ExecutionContext;
};

const admin: AuthUser = { id: '1', email: 'a@b.com', role: UserRole.ADMIN };
const member: AuthUser = { id: '2', email: 'u@b.com', role: UserRole.USER };

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles', () => {
    expect(guard.canActivate(contextFor({}, member))).toBe(true);
  });

  it('allows a matching role', () => {
    expect(guard.canActivate(contextFor({ [ROLES_KEY]: [UserRole.ADMIN] }, admin))).toBe(true);
  });

  it('forbids other roles', () => {
    expect(() => guard.canActivate(contextFor({ [ROLES_KEY]: [UserRole.ADMIN] }, member))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a missing user', () => {
    expect(() => guard.canActivate(contextFor({ [ROLES_KEY]: [UserRole.ADMIN] }))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('JwtAuthGuard', () => {
  it('lets @Public() routes through without a token', () => {
    const guard = new JwtAuthGuard(new Reflector());
    expect(guard.canActivate(contextFor({ [IS_PUBLIC_KEY]: true }))).toBe(true);
  });

  it('lets Kafka events through (no HTTP request or token)', () => {
    const guard = new JwtAuthGuard(new Reflector());
    expect(guard.canActivate(contextFor({}, undefined, 'rpc'))).toBe(true);
  });
});
