import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '@/modules/auth/interfaces/auth-user.interface';
import { JwtPayload, TokenType } from '@/modules/auth/interfaces/jwt-payload.interface';
import jwtConfig from '@/core/config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.type !== TokenType.ACCESS) {
      throw new UnauthorizedException('Invalid token type');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
