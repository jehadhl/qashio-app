import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { PeriodRange } from '@/modules/budgets/interfaces/budget-usage.interface';

export function getPeriodRange(
  period: BudgetPeriod,
  now: Date = new Date(),
): PeriodRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  switch (period) {
    case BudgetPeriod.WEEKLY: {
      const daysSinceMonday = (now.getUTCDay() + 6) % 7;
      return {
        start: new Date(Date.UTC(year, month, day - daysSinceMonday)),
        end: new Date(Date.UTC(year, month, day - daysSinceMonday + 7)),
      };
    }
    case BudgetPeriod.MONTHLY:
      return {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month + 1, 1)),
      };
    case BudgetPeriod.YEARLY:
      return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
      };
  }
}
