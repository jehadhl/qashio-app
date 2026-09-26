import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';
import { BudgetPeriod } from '@/modules/budgets/enums/budget-period.enum';

export class CreateBudgetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9_999_999_999.99)
  amount!: number;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  @IsEnum(BudgetPeriod)
  period!: BudgetPeriod;
}