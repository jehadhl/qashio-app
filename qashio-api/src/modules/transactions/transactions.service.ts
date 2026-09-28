import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import { OutboxService } from '@/core/outbox/outbox.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CreateTransactionDto } from '@/modules/transactions/dto/create-transaction.dto';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { TransactionSummaryQueryDto } from '@/modules/transactions/dto/transaction-summary-query.dto';
import {
  CategorySummaryDto,
  TransactionSummaryDto,
} from '@/modules/transactions/dto/transaction-summary.dto';
import { UpdateTransactionDto } from '@/modules/transactions/dto/update-transaction.dto';

import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { toTransactionEventPayload } from '@/modules/transactions/events/transaction-event.mapper';

type TransactionTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const category = await this.categoriesService.findOneOrFail(
      userId,
      dto.categoryId,
    );

    const transaction = this.transactionsRepository.create({
      userId,
      categoryId: category.id,
      amount: dto.amount,
      type: dto.type,
      status: dto.status ?? TransactionStatus.COMPLETED,
      date: new Date(dto.date),
      counterparty: dto.counterparty,
      reference: dto.reference ?? null,
      narration: dto.narration ?? null,
    });

    const saved = await this.saveWithEvent(
      transaction,
      KAFKA_TOPICS.TRANSACTION_CREATED,
    );
    saved.category = category;
    return saved;
  }

  findAll(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<[Transaction[], number]> {
    return this.transactionsRepository.findPaginated(userId, query);
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneByIdAndUser(
      id,
      userId,
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findOne(userId, id);

    const category =
      dto.categoryId === transaction.categoryId
        ? transaction.category
        : await this.categoriesService.findOneOrFail(userId, dto.categoryId);

    transaction.amount = dto.amount;
    transaction.type = dto.type;
    transaction.status = dto.status;
    transaction.date = new Date(dto.date);
    transaction.counterparty = dto.counterparty;
    transaction.reference = dto.reference;
    transaction.narration = dto.narration;
    transaction.category = category;
    transaction.categoryId = category.id;

    return this.saveWithEvent(transaction, KAFKA_TOPICS.TRANSACTION_UPDATED);
  }

  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.findOne(userId, id);
    await this.transactionsRepository.remove(transaction);
  }

  // The row and its outbox event commit together or not at all; the relay publishes later,
  // so a Kafka outage never fails the request or loses the event.
  private saveWithEvent(
    transaction: Transaction,
    topic: TransactionTopic,
  ): Promise<Transaction> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const saved = await manager.save(transaction);
      const eventId = randomUUID();
      await this.outbox.add(manager, {
        id: eventId,
        aggregateType: 'transaction',
        aggregateId: saved.id,
        topic,
        messageKey: saved.userId,
        payload: toTransactionEventPayload(saved, eventId),
      });
      return saved;
    });
  }

  // Completed income/expense totals for a date range, overall and per category
  async getSummary(
    userId: string,
    query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummaryDto> {
    const rows =
      await this.transactionsRepository.sumCompletedByCategoryAndType(
        userId,
        query,
      );

    const byCategory = new Map<string, CategorySummaryDto>();
    let totalIncome = 0;
    let totalExpense = 0;
    let count = 0;

    for (const row of rows) {
      const total = Number(row.total);
      const entry = byCategory.get(row.categoryId) ?? {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        income: 0,
        expense: 0,
      };
      if (row.type === TransactionType.INCOME) {
        entry.income += total;
        totalIncome += total;
      } else {
        entry.expense += total;
        totalExpense += total;
      }
      count += Number(row.count);
      byCategory.set(row.categoryId, entry);
    }

    // Round to cents: summing floats can leave artifacts like 0.30000000000000004
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
      totalIncome: round(totalIncome),
      totalExpense: round(totalExpense),
      net: round(totalIncome - totalExpense),
      count,
      byCategory: [...byCategory.values()].map((entry) => ({
        ...entry,
        income: round(entry.income),
        expense: round(entry.expense),
      })),
    };
  }

  // Spent per category in [from, to): completed expenses only. Used by budgets.
  getCompletedExpensesByCategory(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    return this.transactionsRepository.sumCompletedExpensesByCategory(
      userId,
      from,
      to,
    );
  }
}
