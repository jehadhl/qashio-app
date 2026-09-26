import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';

export class LoginDto extends PickType(CreateUserDto, ['email'] as const) {
  // No length rules beyond bcrypt's limit: the password policy is checked at sign-up,
  // and repeating it here would tell attackers what valid passwords look like.
  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}
