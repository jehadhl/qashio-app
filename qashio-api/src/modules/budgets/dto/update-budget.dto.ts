import { PickType } from '@nestjs/swagger';
import { CreateBudgetDto } from '@/modules/budgets/dto/create-budget.dto';

export class UpdateBudgetDto extends PickType(CreateBudgetDto, [
  'amount',
  'period',
] as const) {}
