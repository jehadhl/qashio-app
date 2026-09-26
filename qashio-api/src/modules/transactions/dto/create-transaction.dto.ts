import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';
import { Trim } from '@/common/decorators/transform.decorators';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';

export class CreateTransactionDto {
  @ApiProperty({ example: 250.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9_999_999_999.99) // numeric(12,2) limit
  amount!: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @ApiProperty({ example: '2026-09-25T10:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Acme Corp' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  counterparty!: string;

  @ApiProperty({ example: 'INV-1001' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  reference!: string;

  @ApiProperty({ example: 'Monthly office electricity bill' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  narration!: string;
}
