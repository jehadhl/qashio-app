import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';

// Public sign-up: same rules as CreateUserDto, minus `role` - new accounts are
// always normal users. Sending `role` is rejected (forbidNonWhitelisted).
export class RegisterDto extends OmitType(CreateUserDto, ['role'] as const) {}
