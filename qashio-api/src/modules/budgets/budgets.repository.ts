import { Injectable } from '@nestjs/common';
import { DataSource, Not, Repository } from 'typeorm';
import { Budget } from '@/modules/budgets/entities/budgets.entity';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';

@Injectable()
export class BudgetsRepository extends Repository<Budget> {
  constructor(dataSource: DataSource) {
    super(Budget, dataSource.createEntityManager());
  }

  findAllByUser(userId: string): Promise<Budget[]> {
    return this.find({
      where: { userId },
      relations: { category: true },
      order: { category: { name: 'ASC' }, period: 'ASC' },
    });
  }

  findOneByIdAndUser(id: string, userId: string): Promise<Budget | null> {
    return this.findOne({
      where: { id, userId },
      relations: { category: true },
    });
  }

  existsForCategoryAndPeriod(
    userId: string,
    categoryId: string,
    period: BudgetPeriod,
    excludeId?: string,
  ): Promise<boolean> {
    return this.existsBy({
      userId,
      categoryId,
      period,
      ...(excludeId && { id: Not(excludeId) }),
    });
  }

  findAllByUserAndCategory(
    userId: string,
    categoryId: string,
  ): Promise<Budget[]> {
    return this.find({
      where: { userId, categoryId },
      relations: { category: true },
    });
  }
}
