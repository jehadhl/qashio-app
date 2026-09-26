import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { Category } from '@/modules/categories/entities/category.entity';


@ApiTags('Categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiCreatedResponse({ type: Category })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "The current user's categories" })
  @ApiOkResponse({ type: [Category] })
  findAll(@CurrentUser('id') userId: string): Promise<Category[]> {
    return this.categoriesService.findAll(userId);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Every user\'s categories, paginated (admin only)' })
  @ApiOkResponse({ description: 'Paginated list of categories' })
  @ApiForbiddenResponse({ description: 'Only admins can list all categories' })
  findAllForAdmin(@Query() query: PaginationDto) {
    return this.categoriesService.findAllForAdmin(query);
  }
}
