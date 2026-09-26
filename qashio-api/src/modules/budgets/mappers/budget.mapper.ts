import { BudgetResponseDto } from '@/modules/budgets/dto/budget-response.dto';
import { Budget } from '@/modules/budgets/entities/budgets.entity';

import {
  BudgetUsage,
  PeriodRange,
} from '@/modules/budgets/interfaces/budget-usage.interface';

export interface BudgetWithUsage {
  budget: Budget;
  range: PeriodRange;
  usage: BudgetUsage;
}

export const toBudgetResponse = ({
  budget,
  range,
  usage,
}: BudgetWithUsage): BudgetResponseDto => ({
  id: budget.id,
  amount: budget.amount,
  period: budget.period,
  category: { id: budget.category.id, name: budget.category.name },
  periodStart: range.start,
  periodEnd: range.end,
  ...usage,
  createdAt: budget.createdAt,
  updatedAt: budget.updatedAt,
});
