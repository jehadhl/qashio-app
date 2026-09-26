import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '@/common/entities/abstract.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';

@Entity('users')
export class User extends AbstractEntity {
  @ApiProperty({ example: 'jehad@example.com' })
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @ApiProperty({ example: 'Jehad' })
  @Column({ name: 'first_name', type: 'varchar', length: 50 })
  firstName!: string;

  @ApiProperty({ example: 'Hlewi' })
  @Column({ name: 'last_name', type: 'varchar', length: 50 })
  lastName!: string;

  // SHA-256 of the current refresh token; null after logout. Never returned.
  @Exclude()
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64, nullable: true, select: false })
  refreshTokenHash!: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.USER })
  role!: UserRole;
}
