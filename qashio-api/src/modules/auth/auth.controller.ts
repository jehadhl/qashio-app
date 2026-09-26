import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  REMEMBER_ME_COOKIE,
  setAuthCookies,
} from '@/modules/auth/auth-cookies';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthUserResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';

// Tokens live only in httpOnly cookies set here, so they never reach page JavaScript.
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: AuthUserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponseDto> {
    const { user, tokens } = await this.authService.register(dto);
    setAuthCookies(res, tokens, true);
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() { rememberMe, ...credentials }: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponseDto> {
    const { user, tokens } = await this.authService.login(credentials);
    setAuthCookies(res, tokens, rememberMe === true);
    return { user };
  }

  // Swaps the refresh token cookie for a new pair (refresh tokens are single-use).
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'New auth cookies set' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, expired or already-used refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    try {
      if (!refreshToken) throw new UnauthorizedException('No refresh token');
      const tokens = await this.authService.refresh(refreshToken);
      setAuthCookies(res, tokens, Boolean(req.cookies?.[REMEMBER_ME_COOKIE]));
    } catch (error) {
      // The session is over: drop the cookies so the app sends the user to /login.
      if (error instanceof UnauthorizedException) clearAuthCookies(res);
      throw error;
    }
  }

  // Public so an expired access token can still sign out; always clears the cookies.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Refresh token revoked and cookies cleared' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) await this.authService.revokeRefreshToken(refreshToken);
    clearAuthCookies(res);
  }
}
