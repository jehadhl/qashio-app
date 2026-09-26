import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthResponseDto, AuthTokensDto } from '@/modules/auth/dto/auth-response.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { RefreshTokenDto } from '@/modules/auth/dto/refresh-token.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired or already-used refresh token' })
  refresh(@Body() { refreshToken }: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Refresh token revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  logout(@CurrentUser('id') userId: string): Promise<void> {
    return this.authService.logout(userId);
  }
}
