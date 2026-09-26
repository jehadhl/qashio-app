import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from '@/modules/categories/categories.service';
import { Category } from '@/modules/categories/entities/category.entity';
import { CreateTransactionDto } from '@/modules/transactions/dto/create-transaction.dto';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { UpdateTransactionDto } from '@/modules/transactions/dto/update-transaction.dto';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventsPublisher } from '@/modules/transactions/events/transaction-events.publisher';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { TransactionsService } from '@/modules/transactions/transactions.service';

describe('TransactionsService', () => {
  const USER = 'user-1';
  const office = Object.assign(new Category(), { id: 'cat-1', name: 'Office', userId: USER });
  const travel = Object.assign(new Category(), { id: 'cat-2', name: 'Travel', userId: USER });

  let existing: Transaction;
  const repo = {
    create: jest.fn((data: Partial<Transaction>) => Object.assign(new Transaction(), data)),
    save: jest.fn((t: Transaction) => Promise.resolve(Object.assign(t, { id: t.id ?? 'tx-new' }))),
    remove: jest.fn(),
    findOneByIdAndUser: jest.fn(),
    findPaginated: jest.fn(),
    sumCompletedExpensesByCategory: jest.fn(),
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
    repo.findOneByIdAndUser.mockImplementation(async (id: string) => (id === 'tx-1' ? existing : null));
    categoriesService.findOneOrFail.mockImplementation(async (_user: string, id: string) => {
      if (id === 'cat-1') return office;
      if (id === 'cat-2') return travel;
      throw new NotFoundException('Category not found');
    });
  });

  describe('create', () => {
    it("saves the transaction under the user's category", async () => {
      const saved = await service.create(USER, body);

      expect(categoriesService.findOneOrFail).toHaveBeenCalledWith(USER, 'cat-1');
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
      expect(repo.save.mock.invocationCallOrder[0]).toBeLessThan(events.publishCreated.mock.invocationCallOrder[0]);
    });

    it("rejects another user's (or a missing) category and saves nothing", async () => {
      await expect(service.create(USER, { ...body, categoryId: 'cat-x' })).rejects.toThrow(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
      expect(events.publishCreated).not.toHaveBeenCalled();
    });
  });

  it('findAll passes the query to the repository', async () => {
    const query = Object.assign(new TransactionQueryDto(), { page: 1, limit: 10 });
    repo.findPaginated.mockResolvedValue([[existing], 1]);

    await expect(service.findAll(USER, query)).resolves.toEqual([[existing], 1]);
    expect(repo.findPaginated).toHaveBeenCalledWith(USER, query);
  });

  describe('findOne', () => {
    it('returns the transaction', async () => {
      await expect(service.findOne(USER, 'tx-1')).resolves.toBe(existing);
      expect(repo.findOneByIdAndUser).toHaveBeenCalledWith('tx-1', USER);
    });

    it("throws NotFound for a missing transaction or another user's", async () => {
      await expect(service.findOne(USER, 'tx-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (PUT: full replace)', () => {
    const put = (overrides: Partial<UpdateTransactionDto> = {}): UpdateTransactionDto => ({
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

    it('moves it to another of the user\'s categories', async () => {
      const result = await service.update(USER, 'tx-1', put({ categoryId: 'cat-2' }));

      expect(categoriesService.findOneOrFail).toHaveBeenCalledWith(USER, 'cat-2');
      expect(result).toMatchObject({ categoryId: 'cat-2', category: travel });
    });

    it("rejects another user's category and changes nothing", async () => {
      await expect(service.update(USER, 'tx-1', put({ categoryId: 'cat-x' }))).rejects.toThrow(NotFoundException);

      expect(repo.save).not.toHaveBeenCalled();
      expect(existing.amount).toBe(100);
    });

    it('publishes transaction.updated after saving', async () => {
      const saved = await service.update(USER, 'tx-1', put());

      expect(events.publishUpdated).toHaveBeenCalledWith(saved);
    });

    it('throws NotFound for a missing transaction', async () => {
      await expect(service.update(USER, 'tx-x', put())).rejects.toThrow(NotFoundException);
      expect(events.publishUpdated).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the transaction', async () => {
      await service.remove(USER, 'tx-1');

      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws NotFound for a missing transaction', async () => {
      await expect(service.remove(USER, 'tx-x')).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  it('getCompletedExpensesByCategory delegates to the repository', async () => {
    const from = new Date('2026-09-01');
    const to = new Date('2026-10-01');
    const totals = new Map([['cat-1', 50]]);
    repo.sumCompletedExpensesByCategory.mockResolvedValue(totals);

    await expect(service.getCompletedExpensesByCategory(USER, from, to)).resolves.toBe(totals);
    expect(repo.sumCompletedExpensesByCategory).toHaveBeenCalledWith(USER, from, to);
  });
});
