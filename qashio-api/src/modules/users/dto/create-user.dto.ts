import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail, Trim } from '@/common/decorators/transform.decorators';
import { UserRole } from '@/modules/users/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'jehad@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Jehad', minLength: 2, maxLength: 50 })
  @Trim()
  @IsString()
  @Length(2, 50)
  firstName!: string;

  @ApiProperty({ example: 'Hlewi', minLength: 2, maxLength: 50 })
  @Trim()
  @IsString()
  @Length(2, 50)
  lastName!: string;

  // Defaults to "user". Only accept this from admin-only endpoints: on public
  // sign-up it would let anyone register as an admin.
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
