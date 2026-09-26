import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsController } from '@/modules/budgets/budgets.controller';
import { BudgetsRepository } from '@/modules/budgets/budgets.repository';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { Budget } from '@/modules/budgets/entities/budgets.entity';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { BudgetEventsConsumer } from '@/modules/budgets/consumers/budget-events.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Budget]), CategoriesModule, TransactionsModule],
  controllers: [BudgetsController , BudgetEventsConsumer],
  providers: [BudgetsService, BudgetsRepository],
})
export class BudgetsModule {}
