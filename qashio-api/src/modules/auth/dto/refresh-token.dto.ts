import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token from login, register or a previous refresh' })
  @IsJWT()
  refreshToken!: string;
}
