import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class TransactionSummaryQueryDto {
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
