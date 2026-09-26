import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionEventsPublisher } from '@/modules/transactions/events/transaction-events.publisher';
import { TransactionsController } from '@/modules/transactions/transactions.controller';
import { TransactionsRepository } from '@/modules/transactions/transactions.repository';
import { TransactionsService } from '@/modules/transactions/transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository, TransactionEventsPublisher],
  exports: [TransactionsService],
})
export class TransactionsModule {}
