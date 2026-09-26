import { Test } from '@nestjs/testing';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { Category } from '@/modules/categories/entities/category.entity';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionsController } from '@/modules/transactions/transactions.controller';
import { TransactionsService } from '@/modules/transactions/transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  const transactionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getSummary: jest.fn(),
  };

  // An entity as the service returns it: with internals (userId, full category) that
  // must not leak into responses.
  const entity = Object.assign(new Transaction(), {
    id: 'tx-1',
    userId: 'user-1',
    amount: 99.5,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    date: new Date('2026-09-01T00:00:00.000Z'),
    reference: 'INV-1',
    counterparty: 'Acme Corp',
    narration: 'Supplies',
    categoryId: 'cat-1',
    category: Object.assign(new Category(), {
      id: 'cat-1',
      name: 'Office',
      userId: 'user-1',
    }),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  });

  const response = {
    id: 'tx-1',
    amount: 99.5,
    type: 'expense',
    status: 'completed',
    date: entity.date,
    reference: 'INV-1',
    counterparty: 'Acme Corp',
    narration: 'Supplies',
    category: { id: 'cat-1', name: 'Office' },
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: transactionsService },
      ],
    }).compile();
    controller = moduleRef.get(TransactionsController);
  });

  it('POST /transactions creates it and returns the response DTO', async () => {
    transactionsService.create.mockResolvedValue(entity);
    const dto = {
      amount: 99.5,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.COMPLETED,
      date: '2026-09-01',
      categoryId: 'cat-1',
      counterparty: 'Acme Corp',
      reference: 'INV-1',
      narration: 'Supplies',
    };

    const result = await controller.create('user-1', dto);

    expect(transactionsService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(response);
    expect(result).not.toHaveProperty('userId');
  });

  it('GET /transactions returns a page of response DTOs with pagination', async () => {
    transactionsService.findAll.mockResolvedValue([[entity], 21]);
    const query = Object.assign(new TransactionQueryDto(), {
      page: 2,
      limit: 10,
    });

    const result = await controller.findAll('user-1', query);

    expect(transactionsService.findAll).toHaveBeenCalledWith('user-1', query);
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.data).toEqual([response]);
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it('GET /transactions/:id returns one', async () => {
    transactionsService.findOne.mockResolvedValue(entity);

    await expect(controller.findOne('user-1', 'tx-1')).resolves.toEqual(
      response,
    );
    expect(transactionsService.findOne).toHaveBeenCalledWith('user-1', 'tx-1');
  });

  it('PUT /transactions/:id replaces it', async () => {
    transactionsService.update.mockResolvedValue(entity);
    const dto = {
      amount: 99.5,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.COMPLETED,
      date: '2026-09-01',
      categoryId: 'cat-1',
      counterparty: 'Acme Corp',
      reference: 'INV-1',
      narration: 'Supplies',
    };

    await expect(controller.update('user-1', 'tx-1', dto)).resolves.toEqual(
      response,
    );
    expect(transactionsService.update).toHaveBeenCalledWith(
      'user-1',
      'tx-1',
      dto,
    );
  });

  it('DELETE /transactions/:id removes it and returns nothing', async () => {
    transactionsService.remove.mockResolvedValue(undefined);

    await expect(controller.remove('user-1', 'tx-1')).resolves.toBeUndefined();
    expect(transactionsService.remove).toHaveBeenCalledWith('user-1', 'tx-1');
  });

  it('GET /transactions/summary returns the service summary', async () => {
    const summary = {
      startDate: null,
      endDate: null,
      totalIncome: 10,
      totalExpense: 4,
      net: 6,
      count: 2,
      byCategory: [],
    };
    transactionsService.getSummary.mockResolvedValue(summary);

    await expect(controller.getSummary('user-1', {})).resolves.toEqual(summary);
    expect(transactionsService.getSummary).toHaveBeenCalledWith('user-1', {});
  });
});
