import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { BudgetsRepository } from '@/modules/budgets/budgets.repository';
import { CreateBudgetDto } from '@/modules/budgets/dto/create-budget.dto';
import { UpdateBudgetDto } from '@/modules/budgets/dto/update-budget.dto';
import { Budget } from '@/modules/budgets/entities/budgets.entity';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { BudgetWithUsage } from '@/modules/budgets/mappers/budget.mapper';
import { getPeriodRange } from '@/modules/budgets/utils/budget-period.util';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async checkUsageForCategory(userId: string, categoryId: string): Promise<BudgetWithUsage[]> {
  const budgets = await this.budgetsRepository.findAllByUserAndCategory(userId, categoryId);
  return this.withUsage(userId, budgets);
}

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetWithUsage> {
    const category = await this.categoriesService.findOneOrFail(userId, dto.categoryId);
    await this.assertNoDuplicate(userId, category.id, dto.period);

    const budget = this.budgetsRepository.create({
      userId,
      categoryId: category.id,
      amount: dto.amount,
      period: dto.period,
    });
    const saved = await this.budgetsRepository.save(budget);
    saved.category = category;

    const [result] = await this.withUsage(userId, [saved]);
    return result;
  }

  async findAll(userId: string): Promise<BudgetWithUsage[]> {
    const budgets = await this.budgetsRepository.findAllByUser(userId);
    return this.withUsage(userId, budgets);
  }

  async findOne(userId: string, id: string): Promise<BudgetWithUsage> {
    const [result] = await this.withUsage(userId, [await this.findOneOrFail(userId, id)]);
    return result;
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetWithUsage> {
    const budget = await this.findOneOrFail(userId, id);

    if (dto.period !== budget.period) {
      await this.assertNoDuplicate(userId, budget.categoryId, dto.period, budget.id);
    }

    budget.amount = dto.amount;
    budget.period = dto.period;
    const saved = await this.budgetsRepository.save(budget);

    const [result] = await this.withUsage(userId, [saved]);
    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    const budget = await this.findOneOrFail(userId, id);
    await this.budgetsRepository.remove(budget);
  }


  private async findOneOrFail(userId: string, id: string): Promise<Budget> {
    const budget = await this.budgetsRepository.findOneByIdAndUser(id, userId);
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }

  private async assertNoDuplicate(
    userId: string,
    categoryId: string,
    period: BudgetPeriod,
    excludeId?: string,
  ): Promise<void> {
    const exists = await this.budgetsRepository.existsForCategoryAndPeriod(
      userId,
      categoryId,
      period,
      excludeId,
    );
    if (exists) {
      throw new ConflictException(`A ${period} budget already exists for this category`);
    }
  }


  private async withUsage(userId: string, budgets: Budget[]): Promise<BudgetWithUsage[]> {
    const periods = [...new Set(budgets.map((budget) => budget.period))];

    const totalsByPeriod = new Map(
      await Promise.all(
        periods.map(async (period) => {
          const range = getPeriodRange(period);
          const totals = await this.transactionsService.getCompletedExpensesByCategory(
            userId,
            range.start,
            range.end,
          );
          return [period, { range, totals }] as const;
        }),
      ),
    );

    return budgets.map((budget) => {
      const { range, totals } = totalsByPeriod.get(budget.period)!;
      const spent = totals.get(budget.categoryId) ?? 0;
      return { budget, range, usage: budget.calculateUsage(spent) };
    });
  }
}