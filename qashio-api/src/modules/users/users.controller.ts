import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { User } from '@/modules/users/entities/users.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { UsersService } from '@/modules/users/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'All users, paginated (admin only)' })
  @ApiOkResponse({ description: 'Paginated list of users' })
  @ApiForbiddenResponse({ description: 'Only admins can list users' })
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'The logged-in user' })
  @ApiOkResponse({ type: User })
  me(@CurrentUser('id') userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }
}
