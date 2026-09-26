import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AbstractEntity } from '@/common/entities/abstract.entity';
import { User } from '@/modules/users/entities/users.entity';

@Entity('categories')
@Unique('uq_categories_user_name', ['userId', 'name'])
export class Category extends AbstractEntity {
  @ApiProperty({ example: 'Groceries' })
  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Exclude()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_categories_user_id',
  })
  user!: User;
}
