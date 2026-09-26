import { Test } from '@nestjs/testing';
import { BudgetsController } from '@/modules/budgets/budgets.controller';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { Budget } from '@/modules/budgets/entities/budgets.entity';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { BudgetWithUsage } from '@/modules/budgets/mappers/budget.mapper';

describe('BudgetsController', () => {
  let controller: BudgetsController;
  const budgetsService = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };

  const withUsage: BudgetWithUsage = {
    budget: Object.assign(new Budget(), {
      id: 'budget-1',
      userId: 'user-1',
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Groceries', userId: 'user-1' },
      amount: 500,
      period: BudgetPeriod.MONTHLY,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    }),
    range: { start: new Date('2026-09-01T00:00:00Z'), end: new Date('2026-10-01T00:00:00Z') },
    usage: { spent: 320.5, remaining: 179.5, percentage: 64, isExceeded: false },
  };

  // What clients get: budget + category (id, name only) + period window + usage.
  const response = {
    id: 'budget-1',
    amount: 500,
    period: BudgetPeriod.MONTHLY,
    category: { id: 'cat-1', name: 'Groceries' },
    periodStart: withUsage.range.start,
    periodEnd: withUsage.range.end,
    spent: 320.5,
    remaining: 179.5,
    percentage: 64,
    isExceeded: false,
    createdAt: withUsage.budget.createdAt,
    updatedAt: withUsage.budget.updatedAt,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: budgetsService }],
    }).compile();
    controller = moduleRef.get(BudgetsController);
  });

  it('POST /budgets creates it and returns it with usage', async () => {
    budgetsService.create.mockResolvedValue(withUsage);
    const dto = { categoryId: 'cat-1', amount: 500, period: BudgetPeriod.MONTHLY };

    await expect(controller.create('user-1', dto)).resolves.toEqual(response);
    expect(budgetsService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('GET /budgets lists them with current spending', async () => {
    budgetsService.findAll.mockResolvedValue([withUsage]);

    await expect(controller.findAll('user-1')).resolves.toEqual([response]);
  });

  it('GET /budgets/:id returns one', async () => {
    budgetsService.findOne.mockResolvedValue(withUsage);

    await expect(controller.findOne('user-1', 'budget-1')).resolves.toEqual(response);
    expect(budgetsService.findOne).toHaveBeenCalledWith('user-1', 'budget-1');
  });

  it('PUT /budgets/:id updates amount and period', async () => {
    budgetsService.update.mockResolvedValue(withUsage);
    const dto = { amount: 600, period: BudgetPeriod.WEEKLY };

    await controller.update('user-1', 'budget-1', dto);

    expect(budgetsService.update).toHaveBeenCalledWith('user-1', 'budget-1', dto);
  });

  it('DELETE /budgets/:id removes it and returns nothing', async () => {
    await expect(controller.remove('user-1', 'budget-1')).resolves.toBeUndefined();
    expect(budgetsService.remove).toHaveBeenCalledWith('user-1', 'budget-1');
  });

  it('never exposes internal fields', async () => {
    budgetsService.findOne.mockResolvedValue(withUsage);

    const result = await controller.findOne('user-1', 'budget-1');

    expect(result).not.toHaveProperty('userId');
    expect(result.category).not.toHaveProperty('userId');
  });
});
