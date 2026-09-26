import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategorySummaryDto {
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() income!: number;
  @ApiProperty() expense!: number;
}

export class TransactionSummaryDto {
  @ApiPropertyOptional({ nullable: true }) startDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) endDate!: string | null;
  @ApiProperty() totalIncome!: number;
  @ApiProperty() totalExpense!: number;
  @ApiProperty({ description: 'totalIncome - totalExpense' }) net!: number;
  @ApiProperty({ description: 'Number of transactions counted' })
  count!: number;
  @ApiProperty({ type: [CategorySummaryDto] })
  byCategory!: CategorySummaryDto[];
}
