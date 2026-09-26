import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { BudgetsRepository } from '@/modules/budgets/budgets.repository';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { Budget } from '@/modules/budgets/entities/budgets.entity';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';

describe('BudgetsService', () => {
  const NOW = new Date('2026-09-26T12:00:00.000Z');
  const USER = 'user-1';
  const category = { id: 'cat-1', name: 'Groceries' };

  // Real Budget instances, so calculateUsage() runs for real
  const makeBudget = (overrides: Partial<Budget> = {}): Budget =>
    Object.assign(new Budget(), {
      id: 'budget-1',
      userId: USER,
      categoryId: 'cat-1',
      category,
      amount: 500,
      period: BudgetPeriod.MONTHLY,
      ...overrides,
    });

  const repo = {
    create: jest.fn((data: Partial<Budget>) => Object.assign(new Budget(), data)),
    save: jest.fn((budget: Budget) => Promise.resolve(Object.assign(budget, { id: budget.id ?? 'budget-1' }))),
    remove: jest.fn(),
    findAllByUser: jest.fn(),
    findAllByUserAndCategory: jest.fn(),
    findOneByIdAndUser: jest.fn(),
    existsForCategoryAndPeriod: jest.fn(),
  };
  const categoriesService = { findOneOrFail: jest.fn() };
  const transactionsService = { getCompletedExpensesByCategory: jest.fn() };

  const service = new BudgetsService(
    repo as unknown as BudgetsRepository,
    categoriesService as unknown as CategoriesService,
    transactionsService as unknown as TransactionsService,
  );

  // Spending returned by TransactionsService: { categoryId → total }
  const spending = (entries: Record<string, number> = {}) =>
    transactionsService.getCompletedExpensesByCategory.mockResolvedValue(new Map(Object.entries(entries)));

  beforeAll(() => jest.useFakeTimers({ now: NOW })); // freeze "current month"
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    jest.clearAllMocks();
    categoriesService.findOneOrFail.mockResolvedValue(category);
    repo.existsForCategoryAndPeriod.mockResolvedValue(false);
    spending();
  });

  describe('create', () => {
    const dto = { categoryId: 'cat-1', amount: 500, period: BudgetPeriod.MONTHLY };

    it('saves the budget for the user and returns it with zero usage', async () => {
      const result = await service.create(USER, dto);

      expect(repo.create).toHaveBeenCalledWith({
        userId: USER,
        categoryId: 'cat-1',
        amount: 500,
        period: BudgetPeriod.MONTHLY,
      });
      expect(result.budget).toMatchObject({ id: 'budget-1', amount: 500 });
      expect(result.usage).toEqual({ spent: 0, remaining: 500, percentage: 0, isExceeded: false });
    });

    it('calculates spending for the current month', async () => {
      const result = await service.create(USER, dto);

      expect(transactionsService.getCompletedExpensesByCategory).toHaveBeenCalledWith(
        USER,
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-10-01T00:00:00.000Z'),
      );
      expect(result.range.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('throws NotFound when the category does not belong to the user', async () => {
      categoriesService.findOneOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.create(USER, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws Conflict when a budget for the same category and period exists', async () => {
      repo.existsForCategoryAndPeriod.mockResolvedValue(true);

      await expect(service.create(USER, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.existsForCategoryAndPeriod).toHaveBeenCalledWith(USER, 'cat-1', BudgetPeriod.MONTHLY, undefined);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('attaches the spending of each budget category', async () => {
      repo.findAllByUser.mockResolvedValue([
        makeBudget({ id: 'b-1', categoryId: 'cat-1', amount: 500 }),
        makeBudget({ id: 'b-2', categoryId: 'cat-2', amount: 200 }),
      ]);
      spending({ 'cat-1': 550.5, 'cat-2': 50 });

      const [groceries, transport] = await service.findAll(USER);

      expect(groceries.usage).toEqual({ spent: 550.5, remaining: -50.5, percentage: 110, isExceeded: true });
      expect(transport.usage).toEqual({ spent: 50, remaining: 150, percentage: 25, isExceeded: false });
    });

    it('treats a category with no expenses as zero spent', async () => {
      repo.findAllByUser.mockResolvedValue([makeBudget({ categoryId: 'cat-without-expenses' })]);
      spending({ 'cat-1': 999 });

      const [result] = await service.findAll(USER);

      expect(result.usage.spent).toBe(0);
    });

    it('runs one spending query per distinct period, not per budget', async () => {
      repo.findAllByUser.mockResolvedValue([
        makeBudget({ id: 'b-1', categoryId: 'cat-1', period: BudgetPeriod.MONTHLY }),
        makeBudget({ id: 'b-2', categoryId: 'cat-2', period: BudgetPeriod.MONTHLY }),
        makeBudget({ id: 'b-3', categoryId: 'cat-1', period: BudgetPeriod.WEEKLY }),
      ]);

      await service.findAll(USER);

      expect(transactionsService.getCompletedExpensesByCategory).toHaveBeenCalledTimes(2);
    });

    it('does not query spending when the user has no budgets', async () => {
      repo.findAllByUser.mockResolvedValue([]);

      await expect(service.findAll(USER)).resolves.toEqual([]);
      expect(transactionsService.getCompletedExpensesByCategory).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the budget with its usage', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(makeBudget());
      spending({ 'cat-1': 100 });

      const result = await service.findOne(USER, 'budget-1');

      expect(repo.findOneByIdAndUser).toHaveBeenCalledWith('budget-1', USER);
      expect(result.usage.spent).toBe(100);
    });

    it("throws NotFound for a missing or another user's budget", async () => {
      repo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.findOne(USER, 'budget-404')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the amount without a duplicate check when the period is unchanged', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(makeBudget());

      const result = await service.update(USER, 'budget-1', { amount: 800, period: BudgetPeriod.MONTHLY });

      expect(repo.existsForCategoryAndPeriod).not.toHaveBeenCalled();
      expect(result.budget.amount).toBe(800);
      expect(result.usage.remaining).toBe(800);
    });

    it('checks for a duplicate, excluding itself, when the period changes', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(makeBudget());

      await service.update(USER, 'budget-1', { amount: 100, period: BudgetPeriod.WEEKLY });

      expect(repo.existsForCategoryAndPeriod).toHaveBeenCalledWith(USER, 'cat-1', BudgetPeriod.WEEKLY, 'budget-1');
    });

    it('throws Conflict when the new period is already taken', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(makeBudget());
      repo.existsForCategoryAndPeriod.mockResolvedValue(true);

      await expect(
        service.update(USER, 'budget-1', { amount: 100, period: BudgetPeriod.WEEKLY }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFound when the budget does not exist', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(
        service.update(USER, 'budget-404', { amount: 100, period: BudgetPeriod.MONTHLY }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the budget', async () => {
      const budget = makeBudget();
      repo.findOneByIdAndUser.mockResolvedValue(budget);

      await service.remove(USER, 'budget-1');

      expect(repo.remove).toHaveBeenCalledWith(budget);
    });

    it('throws NotFound when the budget does not exist', async () => {
      repo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.remove(USER, 'budget-404')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('checkUsageForCategory (used by the Kafka consumer)', () => {
    it("returns only the budgets of the transaction's category, with usage", async () => {
      repo.findAllByUserAndCategory.mockResolvedValue([makeBudget()]);
      spending({ 'cat-1': 450 });

      const [result] = await service.checkUsageForCategory(USER, 'cat-1');

      expect(repo.findAllByUserAndCategory).toHaveBeenCalledWith(USER, 'cat-1');
      expect(result.usage).toMatchObject({ spent: 450, percentage: 90, isExceeded: false });
    });
  });
});