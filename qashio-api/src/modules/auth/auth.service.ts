import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { hashPassword, hashToken, verifyPassword, verifyTokenHash } from '@/common/helpers/hash.helper';
import { JwtPayload, TokenType } from '@/modules/auth/interfaces/jwt-payload.interface';
import jwtConfig from '@/core/config/jwt.config';
import { AuthResponseDto, AuthTokensDto } from '@/modules/auth/dto/auth-response.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { User } from '@/modules/users/entities/users.entity';
import { UsersService } from '@/modules/users/users.service';

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = hashPassword(randomUUID());

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create(dto);
    return { user, tokens: await this.issueTokens(user) };
  }

  async login({ email, password }: Omit<LoginDto, 'rememberMe'>): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(email);
    const passwordOk = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyPasswordHash),
    );

    // Same message for unknown email and wrong password.
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user, tokens: await this.issueTokens(user) };
  }

  // Rotation: every refresh token works once and is replaced by a new pair.
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Session expired, please log in again');
    }
    if (!verifyTokenHash(refreshToken, user.refreshTokenHash)) {
   
      await this.usersService.setRefreshTokenHash(user.id, null);
      throw new UnauthorizedException('Session expired, please log in again');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  // Best effort: an invalid or expired token has nothing left to revoke.
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken).catch(() => null);
    if (payload) await this.logout(payload.sub);
  }

  private async issueTokens(user: User): Promise<AuthTokensDto> {
    const claims = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...claims, type: TokenType.ACCESS } satisfies JwtPayload,
        { expiresIn: this.jwt.accessExpiresIn },
      ),
      this.jwtService.signAsync(
        { ...claims, type: TokenType.REFRESH, jti: randomUUID() } satisfies JwtPayload,
        { expiresIn: this.jwt.refreshExpiresIn },
      ),
    ]);

    await this.usersService.setRefreshTokenHash(user.id, hashToken(refreshToken));

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: String(this.jwt.accessExpiresIn) };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== TokenType.REFRESH) {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }
}
