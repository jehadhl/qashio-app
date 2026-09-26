import { registerAs } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';

type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

// Read as configService.get('jwt.secret')
export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return {
    secret,
    accessExpiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as ExpiresIn,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as ExpiresIn,
  };
});
