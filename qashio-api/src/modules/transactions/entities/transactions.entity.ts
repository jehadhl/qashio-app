import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '@/common/entities/abstract.entity';
import { decimalTransformer } from '@/common/transformers/decimal.transformer';
import { Category } from '@/modules/categories/entities/category.entity';
import { User } from '@/modules/users/entities/users.entity';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';

@Entity('transactions')
@Index('idx_transactions_user_date', ['userId', 'date'])
@Index('idx_transactions_user_category', ['userId', 'categoryId'])
@Check('chk_transactions_amount_positive', '"amount" > 0')
export class Transaction extends AbstractEntity {
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  amount!: number;

  @Column({ type: 'enum', enum: TransactionType, enumName: 'transaction_type' })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    enumName: 'transaction_status',
    default: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @Column({ type: 'timestamptz' })
  date!: Date;

  @Column({ type: 'varchar', length: 50 })
  reference!: string;

  @Column({ type: 'varchar', length: 100 })
  counterparty!: string;

  @Column({ type: 'text' })
  narration!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: Category;
}