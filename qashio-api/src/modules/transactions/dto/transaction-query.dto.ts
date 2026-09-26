import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';

export const TRANSACTION_SORT_FIELDS = ['date', 'amount'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export class TransactionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TRANSACTION_SORT_FIELDS, default: 'date' })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  override sortBy: TransactionSortField = 'date';

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Inclusive' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Inclusive (whole day)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
