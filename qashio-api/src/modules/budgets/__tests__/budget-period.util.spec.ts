import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';
import { getPeriodRange } from '@/modules/budgets/utils/budget-period.util';

describe('getPeriodRange', () => {
  const now = new Date('2026-09-26T15:30:00Z'); 

  it('monthly → first of month to first of next month', () => {
    const { start, end } = getPeriodRange(BudgetPeriod.MONTHLY, now);
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('weekly → Monday to next Monday', () => {
    const { start, end } = getPeriodRange(BudgetPeriod.WEEKLY, now);
    expect(start.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('yearly → Jan 1 to next Jan 1', () => {
    const { start, end } = getPeriodRange(BudgetPeriod.YEARLY, now);
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('monthly in December rolls over to next year', () => {
    const { end } = getPeriodRange(BudgetPeriod.MONTHLY, new Date('2026-12-15T00:00:00Z'));
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});