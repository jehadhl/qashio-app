import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { Category } from '@/modules/categories/entities/category.entity';
import { CreateTransactionDto } from '@/modules/transactions/dto/create-transaction.dto';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { UpdateTransactionDto } from '@/modules/transactions/dto/update-transaction.dto';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventsPublisher } from '@/modules/transactions/events/transaction-events.publisher';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { TransactionsService } from '@/modules/transactions/transactions.service';

describe('TransactionsService', () => {
  const USER = 'user-1';
  const office = Object.assign(new Category(), {
    id: 'cat-1',
    name: 'Office',
    userId: USER,
  });
  const travel = Object.assign(new Category(), {
    id: 'cat-2',
    name: 'Travel',
    userId: USER,
  });

  let existing: Transaction;
  const repo = {
    create: jest.fn((data: Partial<Transaction>) =>
      Object.assign(new Transaction(), data),
    ),
    save: jest.fn((t: Transaction) =>
      Promise.resolve(Object.assign(t, { id: t.id ?? 'tx-new' })),
    ),
    remove: jest.fn(),
    findOneByIdAndUser: jest.fn(),
    findPaginated: jest.fn(),
    sumCompletedExpensesByCategory: jest.fn(),
    sumCompletedByCategoryAndType: jest.fn(),
  };
  const categoriesService = { findOneOrFail: jest.fn() };
  const events = { publishCreated: jest.fn(), publishUpdated: jest.fn() };
  const service = new TransactionsService(
    repo as unknown as TransactionsRepository,
    categoriesService as unknown as CategoriesService,
    events as unknown as TransactionEventsPublisher,
  );

  const body: CreateTransactionDto = {
    amount: 100,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    date: '2026-09-01T10:00:00.000Z',
    categoryId: 'cat-1',
    counterparty: 'Acme Corp',
    reference: 'INV-1',
    narration: 'Office supplies',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    existing = Object.assign(new Transaction(), {
      id: 'tx-1',
      userId: USER,
      amount: 100,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.COMPLETED,
      date: new Date('2026-09-01T00:00:00.000Z'),
      counterparty: 'Acme Corp',
      reference: 'INV-1',
      narration: 'Office supplies',
      categoryId: 'cat-1',
      category: office,
    });
    repo.findOneByIdAndUser.mockImplementation((id: string) =>
      Promise.resolve(id === 'tx-1' ? existing : null),
    );
    categoriesService.findOneOrFail.mockImplementation(
      (_user: string, id: string) => {
        if (id === 'cat-1') return Promise.resolve(office);
        if (id === 'cat-2') return Promise.resolve(travel);
        return Promise.reject(new NotFoundException('Category not found'));
      },
    );
  });

  describe('create', () => {
    it("saves the transaction under the user's category", async () => {
      const saved = await service.create(USER, body);

      expect(categoriesService.findOneOrFail).toHaveBeenCalledWith(
        USER,
        'cat-1',
      );
      expect(repo.create).toHaveBeenCalledWith({
        userId: USER,
        categoryId: 'cat-1',
        amount: 100,
        type: TransactionType.EXPENSE,
        status: TransactionStatus.PENDING,
        date: new Date('2026-09-01T10:00:00.000Z'),
        counterparty: 'Acme Corp',
        reference: 'INV-1',
        narration: 'Office supplies',
      });
      expect(saved).toMatchObject({ id: 'tx-new', category: office });
    });

    it('publishes transaction.created after saving', async () => {
      const saved = await service.create(USER, body);

      expect(events.publishCreated).toHaveBeenCalledWith(saved);
      expect(repo.save.mock.invocationCallOrder[0]).toBeLessThan(
        events.publishCreated.mock.invocationCallOrder[0],
      );
    });

    it("rejects another user's (or a missing) category and saves nothing", async () => {
      await expect(
        service.create(USER, { ...body, categoryId: 'cat-x' }),
      ).rejects.toThrow(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
      expect(events.publishCreated).not.toHaveBeenCalled();
    });
  });

  it('findAll passes the query to the repository', async () => {
    const query = Object.assign(new TransactionQueryDto(), {
      page: 1,
      limit: 10,
    });
    repo.findPaginated.mockResolvedValue([[existing], 1]);

    await expect(service.findAll(USER, query)).resolves.toEqual([
      [existing],
      1,
    ]);
    expect(repo.findPaginated).toHaveBeenCalledWith(USER, query);
  });

  describe('findOne', () => {
    it('returns the transaction', async () => {
      await expect(service.findOne(USER, 'tx-1')).resolves.toBe(existing);
      expect(repo.findOneByIdAndUser).toHaveBeenCalledWith('tx-1', USER);
    });

    it("throws NotFound for a missing transaction or another user's", async () => {
      await expect(service.findOne(USER, 'tx-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update (PUT: full replace)', () => {
    const put = (
      overrides: Partial<UpdateTransactionDto> = {},
    ): UpdateTransactionDto => ({
      amount: 250.5,
      type: TransactionType.INCOME,
      status: TransactionStatus.FAILED,
      date: '2026-09-15T08:30:00.000Z',
      categoryId: 'cat-1',
      counterparty: 'Globex',
      reference: 'INV-2',
      narration: 'Refund',
      ...overrides,
    });

    it('replaces every field', async () => {
      const result = await service.update(USER, 'tx-1', put());

      expect(result).toMatchObject({
        id: 'tx-1',
        amount: 250.5,
        type: TransactionType.INCOME,
        status: TransactionStatus.FAILED,
        date: new Date('2026-09-15T08:30:00.000Z'),
        counterparty: 'Globex',
        reference: 'INV-2',
        narration: 'Refund',
      });
      expect(repo.save).toHaveBeenCalledWith(existing);
    });

    it('keeps the loaded category without a lookup when it is unchanged', async () => {
      await service.update(USER, 'tx-1', put({ categoryId: 'cat-1' }));

      expect(categoriesService.findOneOrFail).not.toHaveBeenCalled();
      expect(existing.category).toBe(office);
    });

    it("moves it to another of the user's categories", async () => {
      const result = await service.update(
        USER,
        'tx-1',
        put({ categoryId: 'cat-2' }),
      );

      expect(categoriesService.findOneOrFail).toHaveBeenCalledWith(
        USER,
        'cat-2',
      );
      expect(result).toMatchObject({ categoryId: 'cat-2', category: travel });
    });

    it("rejects another user's category and changes nothing", async () => {
      await expect(
        service.update(USER, 'tx-1', put({ categoryId: 'cat-x' })),
      ).rejects.toThrow(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
      expect(existing.amount).toBe(100);
    });

    it('publishes transaction.updated after saving', async () => {
      const saved = await service.update(USER, 'tx-1', put());

      expect(events.publishUpdated).toHaveBeenCalledWith(saved);
    });

    it('throws NotFound for a missing transaction', async () => {
      await expect(service.update(USER, 'tx-x', put())).rejects.toThrow(
        NotFoundException,
      );
      expect(events.publishUpdated).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the transaction', async () => {
      await service.remove(USER, 'tx-1');

      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws NotFound for a missing transaction', async () => {
      await expect(service.remove(USER, 'tx-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  it('getCompletedExpensesByCategory delegates to the repository', async () => {
    const from = new Date('2026-09-01');
    const to = new Date('2026-10-01');
    const totals = new Map([['cat-1', 50]]);
    repo.sumCompletedExpensesByCategory.mockResolvedValue(totals);

    await expect(
      service.getCompletedExpensesByCategory(USER, from, to),
    ).resolves.toBe(totals);
    expect(repo.sumCompletedExpensesByCategory).toHaveBeenCalledWith(
      USER,
      from,
      to,
    );
  });

  describe('getSummary', () => {
    it('totals income and expense overall and per category', async () => {
      repo.sumCompletedByCategoryAndType.mockResolvedValue([
        {
          categoryId: 'cat-1',
          categoryName: 'Office',
          type: TransactionType.EXPENSE,
          total: '0.10',
          count: '1',
        },
        {
          categoryId: 'cat-1',
          categoryName: 'Office',
          type: TransactionType.INCOME,
          total: '500.00',
          count: '2',
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Travel',
          type: TransactionType.EXPENSE,
          total: '0.20',
          count: '3',
        },
      ]);
      const query = { startDate: '2026-09-01', endDate: '2026-09-30' };

      const summary = await service.getSummary(USER, query);

      expect(repo.sumCompletedByCategoryAndType).toHaveBeenCalledWith(
        USER,
        query,
      );
      expect(summary).toEqual({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        totalIncome: 500,
        totalExpense: 0.3,
        net: 499.7,
        count: 6,
        byCategory: [
          {
            categoryId: 'cat-1',
            categoryName: 'Office',
            income: 500,
            expense: 0.1,
          },
          {
            categoryId: 'cat-2',
            categoryName: 'Travel',
            income: 0,
            expense: 0.2,
          },
        ],
      });
    });

    it('returns zeros when there are no transactions', async () => {
      repo.sumCompletedByCategoryAndType.mockResolvedValue([]);

      await expect(service.getSummary(USER, {})).resolves.toEqual({
        startDate: null,
        endDate: null,
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        count: 0,
        byCategory: [],
      });
    });
  });
});
