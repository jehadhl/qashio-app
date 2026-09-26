import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';

export class BudgetCategoryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Groceries' }) name!: string;
}

export class BudgetResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 500 }) amount!: number;
  @ApiProperty({ enum: BudgetPeriod }) period!: BudgetPeriod;
  @ApiProperty({ type: BudgetCategoryDto }) category!: BudgetCategoryDto;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' }) periodStart!: Date;
  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Exclusive',
  })
  periodEnd!: Date;

  @ApiProperty({ example: 320.5 }) spent!: number;
  @ApiProperty({ example: 179.5 }) remaining!: number;
  @ApiProperty({ example: 64 }) percentage!: number;
  @ApiProperty({ example: false }) isExceeded!: boolean;

  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
