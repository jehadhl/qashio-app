import { ApiProperty } from '@nestjs/swagger';
import { User } from '@/modules/users/entities/users.entity';

export class AuthTokensDto {
  @ApiProperty({ description: 'Send as "Authorization: Bearer <token>"' })
  accessToken!: string;

  @ApiProperty({ description: 'Exchange at POST /auth/refresh for a new pair' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: '15m', description: 'Access token lifetime' })
  expiresIn!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: User })
  user!: User;

  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;
}
