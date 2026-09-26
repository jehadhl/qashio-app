import { Check, Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AbstractEntity } from '@/common/entities/abstract.entity';
import { decimalTransformer } from '@/common/transformers/decimal.transformer';
import { Category } from '@/modules/categories/entities/category.entity';
import { User } from '@/modules/users/entities/users.entity';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { BudgetUsage } from '@/modules/budgets/interfaces/budget-usage.interface';

const round2 = (value: number) => Math.round(value * 100) / 100;

@Entity('budgets')
@Unique('uq_budgets_user_category_period', ['userId', 'categoryId', 'period'])
@Check('chk_budgets_amount_positive', '"amount" > 0')
export class Budget extends AbstractEntity {
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number;

  @Column({ type: 'enum', enum: BudgetPeriod, enumName: 'budget_period' })
  period!: BudgetPeriod;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_budgets_user_id',
  })
  user!: User;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'fk_budgets_category_id',
  })
  category!: Category;

  // Business rule lives with the data it belongs to
  calculateUsage(spent: number): BudgetUsage {
    const remaining = round2(this.amount - spent);
    return {
      spent: round2(spent),
      remaining,
      percentage: Math.round((spent / this.amount) * 100),
      isExceeded: remaining < 0,
    };
  }
}
