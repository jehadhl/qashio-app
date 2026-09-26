import { Not } from 'typeorm';
import { BudgetsRepository } from '@/modules/budgets/budgets.repository';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { stubDataSource } from '@/common/helpers/repository.mock';

describe('BudgetsRepository', () => {
  let repo: BudgetsRepository;

  beforeEach(() => {
    repo = new BudgetsRepository(stubDataSource());
  });

  it('findAllByUser loads categories, ordered by category name then period', async () => {
    const find = jest.spyOn(repo, 'find').mockResolvedValue([]);

    await repo.findAllByUser('user-1');

    expect(find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: { category: true },
      order: { category: { name: 'ASC' }, period: 'ASC' },
    });
  });

  it('findOneByIdAndUser scopes to the owner and loads the category', async () => {
    const findOne = jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await repo.findOneByIdAndUser('budget-1', 'user-1');

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'budget-1', userId: 'user-1' },
      relations: { category: true },
    });
  });

  describe('existsForCategoryAndPeriod', () => {
    it('checks user + category + period', async () => {
      const existsBy = jest.spyOn(repo, 'existsBy').mockResolvedValue(true);

      await expect(
        repo.existsForCategoryAndPeriod(
          'user-1',
          'cat-1',
          BudgetPeriod.MONTHLY,
        ),
      ).resolves.toBe(true);
      expect(existsBy).toHaveBeenCalledWith({
        userId: 'user-1',
        categoryId: 'cat-1',
        period: BudgetPeriod.MONTHLY,
      });
    });

    it('excludes the budget being updated', async () => {
      const existsBy = jest.spyOn(repo, 'existsBy').mockResolvedValue(false);

      await repo.existsForCategoryAndPeriod(
        'user-1',
        'cat-1',
        BudgetPeriod.WEEKLY,
        'budget-1',
      );

      expect(existsBy).toHaveBeenCalledWith({
        userId: 'user-1',
        categoryId: 'cat-1',
        period: BudgetPeriod.WEEKLY,
        id: Not('budget-1'),
      });
    });
  });

  it("findAllByUserAndCategory returns that category's budgets (used by the Kafka consumer)", async () => {
    const find = jest.spyOn(repo, 'find').mockResolvedValue([]);

    await repo.findAllByUserAndCategory('user-1', 'cat-1');

    expect(find).toHaveBeenCalledWith({
      where: { userId: 'user-1', categoryId: 'cat-1' },
      relations: { category: true },
    });
  });
});
