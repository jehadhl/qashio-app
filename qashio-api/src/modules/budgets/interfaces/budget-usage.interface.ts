export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface BudgetUsage {
  spent: number;
  remaining: number;
  percentage: number;
  isExceeded: boolean;
}
