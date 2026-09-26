import { Module } from '@nestjs/common';
import { CoreModule } from '@/core/core.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BudgetsModule } from '@/modules/budgets/budgets.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    // Config, database, Kafka and the global auth guards.
    CoreModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
  ],
})
export class AppModule {}
