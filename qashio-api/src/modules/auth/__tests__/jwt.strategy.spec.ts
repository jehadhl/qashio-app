import { UnauthorizedException } from '@nestjs/common';
import { TokenType } from '@/modules/auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UserRole } from '@/modules/users/enums/user-role.enum';

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({ secret: 's', accessExpiresIn: '15m', refreshExpiresIn: '7d' });
  const claims = { sub: 'user-1', email: 'a@b.com', role: UserRole.ADMIN };

  it('maps an access token to request.user', () => {
    expect(strategy.validate({ ...claims, type: TokenType.ACCESS })).toEqual({
      id: 'user-1',
      email: 'a@b.com',
      role: UserRole.ADMIN,
    });
  });

  it('rejects a refresh token used as an access token', () => {
    expect(() => strategy.validate({ ...claims, type: TokenType.REFRESH })).toThrow(UnauthorizedException);
  });
});
