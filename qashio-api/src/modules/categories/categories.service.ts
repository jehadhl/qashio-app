import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { Category } from '@/modules/categories/entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const exists = await this.categoriesRepository.existsByName(userId, dto.name);
    if (exists) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    const category = this.categoriesRepository.create({ name: dto.name, userId });
    return this.categoriesRepository.save(category);
  }

  findAll(userId: string): Promise<Category[]> {
    return this.categoriesRepository.findAllByUser(userId);
  }

  // Admin only (guarded by @Roles(UserRole.ADMIN) on the route).
  async findAllForAdmin({ page, limit }: PaginationDto): Promise<PaginatedResponseDto<Category>> {
    const [categories, total] = await this.categoriesRepository.findAllPaginated(page, limit);
    return new PaginatedResponseDto(categories, page, limit, total);
  }

  // Used by Transactions & Budgets to verify the category belongs to the user
  async findOneOrFail(userId: string, id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOneByIdAndUser(id, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}