import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transaction } from '@/modules/transactions/entities/transactions.entity';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';

export class TransactionCategoryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: TransactionType }) type!: TransactionType;
  @ApiProperty({ enum: TransactionStatus }) status!: TransactionStatus;
  @ApiProperty() date!: Date;
  @ApiPropertyOptional({ nullable: true }) reference!: string | null;
  @ApiProperty() counterparty!: string;
  @ApiPropertyOptional({ nullable: true }) narration!: string | null;
  @ApiProperty({ type: TransactionCategoryDto }) category!: TransactionCategoryDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      date: transaction.date,
      reference: transaction.reference,
      counterparty: transaction.counterparty,
      narration: transaction.narration,
      category: { id: transaction.category.id, name: transaction.category.name },
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}