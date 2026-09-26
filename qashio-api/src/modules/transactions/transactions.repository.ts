import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, Repository } from 'typeorm';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { TransactionSummaryQueryDto } from '@/modules/transactions/dto/transaction-summary-query.dto';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';

// Escape LIKE wildcards so user input "%" or "_" is matched literally
export interface SummaryRow {
  categoryId: string;
  categoryName: string;
  type: TransactionType;
  total: string;
  count: string;
}

const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class TransactionsRepository extends Repository<Transaction> {
  constructor(dataSource: DataSource) {
    super(Transaction, dataSource.createEntityManager());
  }

  findOneByIdAndUser(id: string, userId: string): Promise<Transaction | null> {
    return this.findOne({
      where: { id, userId },
      relations: { category: true },
    });
  }

  findPaginated(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<[Transaction[], number]> {
    const qb = this.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.category', 'category')
      .where('transaction.userId = :userId', { userId });

    if (query.type) {
      qb.andWhere('transaction.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('transaction.status = :status', { status: query.status });
    }
    if (query.categoryId) {
      qb.andWhere('transaction.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.startDate) {
      qb.andWhere('transaction.date >= CAST(:startDate AS date)', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere(
        "transaction.date < CAST(:endDate AS date) + INTERVAL '1 day'",
        {
          endDate: query.endDate,
        },
      );
    }
    if (query.search?.trim()) {
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('transaction.reference ILIKE :search')
            .orWhere('transaction.counterparty ILIKE :search')
            .orWhere('transaction.narration ILIKE :search');
        }),
      ).setParameter('search', `%${escapeLike(query.search.trim())}%`);
    }

    return qb
      .orderBy(`transaction.${query.sortBy}`, query.sortOrder)
      .addOrderBy('transaction.id', 'DESC') // stable order for pagination
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }

  // Completed totals per category and type within the (whole-day, inclusive) date range
  sumCompletedByCategoryAndType(
    userId: string,
    query: TransactionSummaryQueryDto,
  ): Promise<SummaryRow[]> {
    const qb = this.createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('transaction.type', 'type')
      .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      });

    if (query.startDate) {
      qb.andWhere('transaction.date >= CAST(:startDate AS date)', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere(
        "transaction.date < CAST(:endDate AS date) + INTERVAL '1 day'",
        {
          endDate: query.endDate,
        },
      );
    }

    return qb
      .groupBy('category.id')
      .addGroupBy('category.name')
      .addGroupBy('transaction.type')
      .orderBy('category.name', 'ASC')
      .getRawMany<SummaryRow>();
  }

  async sumCompletedExpensesByCategory(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.createQueryBuilder('transaction')
      .select('transaction.categoryId', 'categoryId')
      .addSelect('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: TransactionType.EXPENSE })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .andWhere('transaction.date >= :from', { from })
      .andWhere('transaction.date < :to', { to })
      .groupBy('transaction.categoryId')
      .getRawMany<{ categoryId: string; total: string }>();

    return new Map(rows.map((row) => [row.categoryId, Number(row.total)]));
  }
}
