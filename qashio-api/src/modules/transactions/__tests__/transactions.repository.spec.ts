import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { createQueryBuilderMock, QueryBuilderMock, stubDataSource } from '@/common/helpers/repository.mock';

const query = (overrides: Partial<TransactionQueryDto> = {}): TransactionQueryDto =>
  Object.assign(new TransactionQueryDto(), { page: 1, limit: 10, sortBy: 'date', sortOrder: 'DESC' }, overrides);

describe('TransactionsRepository', () => {
  let repo: TransactionsRepository;
  let qb: QueryBuilderMock;

  beforeEach(() => {
    repo = new TransactionsRepository(stubDataSource());
    qb = createQueryBuilderMock({ getManyAndCount: [[], 0] });
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb as never);
  });

  it('findOneByIdAndUser loads the category and scopes to the owner', async () => {
    const findOne = jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await repo.findOneByIdAndUser('tx-1', 'user-1');

    expect(findOne).toHaveBeenCalledWith({ where: { id: 'tx-1', userId: 'user-1' }, relations: { category: true } });
  });

  describe('findPaginated', () => {
    it("always scopes to the user and joins the category", async () => {
      await repo.findPaginated('user-1', query());

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('transaction.category', 'category');
      expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', { userId: 'user-1' });
    });

    it('adds no filters when none are given', async () => {
      await repo.findPaginated('user-1', query());

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('filters by type, status and category', async () => {
      await repo.findPaginated(
        'user-1',
        query({ type: TransactionType.INCOME, status: TransactionStatus.PENDING, categoryId: 'cat-1' }),
      );

      expect(qb.calls('andWhere')).toEqual(
        expect.arrayContaining([
          ['transaction.type = :type', { type: 'income' }],
          ['transaction.status = :status', { status: 'pending' }],
          ['transaction.categoryId = :categoryId', { categoryId: 'cat-1' }],
        ]),
      );
    });

    it('treats the date range as whole days, end date inclusive', async () => {
      await repo.findPaginated('user-1', query({ startDate: '2026-09-01', endDate: '2026-09-30' }));

      expect(qb.andWhere).toHaveBeenCalledWith('transaction.date >= CAST(:startDate AS date)', {
        startDate: '2026-09-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith("transaction.date < CAST(:endDate AS date) + INTERVAL '1 day'", {
        endDate: '2026-09-30',
      });
    });

    it('searches reference, counterparty and narration, escaping LIKE wildcards', async () => {
      await repo.findPaginated('user-1', query({ search: '  50%_off\\ ' }));

      expect(qb.setParameter).toHaveBeenCalledWith('search', '%50\\%\\_off\\\\%');
    });

    it('ignores a whitespace-only search', async () => {
      await repo.findPaginated('user-1', query({ search: '   ' }));

      expect(qb.setParameter).not.toHaveBeenCalled();
    });

    it('sorts by the requested field with a stable tie-breaker, then pages', async () => {
      await repo.findPaginated('user-1', query({ sortBy: 'amount', sortOrder: 'ASC', page: 3, limit: 20 }));

      expect(qb.orderBy).toHaveBeenCalledWith('transaction.amount', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('transaction.id', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('returns rows and total', async () => {
      const rows = [{ id: 'tx-1' }];
      qb.getManyAndCount.mockResolvedValue([rows, 1]);

      await expect(repo.findPaginated('user-1', query())).resolves.toEqual([rows, 1]);
    });
  });

  describe('sumCompletedExpensesByCategory', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-10-01T00:00:00Z');

    it('sums only completed expenses in [from, to), grouped by category', async () => {
      await repo.sumCompletedExpensesByCategory('user-1', from, to);

      expect(qb.where).toHaveBeenCalledWith('transaction.userId = :userId', { userId: 'user-1' });
      expect(qb.calls('andWhere')).toEqual([
        ['transaction.type = :type', { type: TransactionType.EXPENSE }],
        ['transaction.status = :status', { status: TransactionStatus.COMPLETED }],
        ['transaction.date >= :from', { from }],
        ['transaction.date < :to', { to }],
      ]);
      expect(qb.groupBy).toHaveBeenCalledWith('transaction.categoryId');
    });

    it('turns the raw rows (numeric comes back as a string) into a Map of numbers', async () => {
      qb.getRawMany.mockResolvedValue([
        { categoryId: 'cat-1', total: '120.50' },
        { categoryId: 'cat-2', total: '0' },
      ]);

      const totals = await repo.sumCompletedExpensesByCategory('user-1', from, to);

      expect(totals).toEqual(new Map([['cat-1', 120.5], ['cat-2', 0]]));
    });
  });
});
