import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Category } from '@/modules/categories/entities/category.entity';

@Injectable()
export class CategoriesRepository extends Repository<Category> {
  constructor(dataSource: DataSource) {
    super(Category, dataSource.createEntityManager());
  }

  findAllByUser(userId: string): Promise<Category[]> {
    return this.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  // Every user's categories, one page at a time (admin only - checked on the route).
  findAllPaginated(page: number, limit: number): Promise<[Category[], number]> {
    return this.findAndCount({
      order: { name: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  findOneByIdAndUser(id: string, userId: string): Promise<Category | null> {
    return this.findOneBy({ id, userId });
  }

  existsByName(userId: string, name: string): Promise<boolean> {
    return this.existsBy({ userId, name });
  }
}
