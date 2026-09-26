import { Injectable, NotFoundException } from '@nestjs/common';
import { assertValidPatch, definedFields } from '@/common/helpers/patch.helper';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CreateTransactionDto } from '@/modules/transactions/dto/create-transaction.dto';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { UpdateTransactionDto } from '@/modules/transactions/dto/update-transaction.dto';

import { TransactionStatus } from '@/modules/transactions/enums/transaction.enums';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionEventsPublisher } from '@/modules/transactions/events/transaction-events.publisher';


const NOT_NULL_FIELDS = ['amount', 'type', 'status', 'date', 'categoryId', 'counterparty'] as const;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly categoriesService: CategoriesService,
     private readonly transactionEvents: TransactionEventsPublisher, 
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const category = await this.categoriesService.findOneOrFail(userId, dto.categoryId);

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

    const saved = await this.transactionsRepository.save(transaction);
    saved.category = category; 

    await this.transactionEvents.publishCreated(saved); 
    return saved;
  }

  findAll(userId: string, query: TransactionQueryDto): Promise<[Transaction[], number]> {
    return this.transactionsRepository.findPaginated(userId, query);
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneByIdAndUser(id, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

 async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
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

    const saved = await this.transactionsRepository.save(transaction);
    await this.transactionEvents.publishUpdated(saved);
    return saved;
  }


  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.findOne(userId, id);
    await this.transactionsRepository.remove(transaction);
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