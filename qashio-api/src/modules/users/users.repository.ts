import { Injectable } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { User } from '@/modules/users/entities/users.entity';

@Injectable()
export class UsersRepository extends Repository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.existsBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.findOneBy({ id });
  }

  findAllPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<[User[], number]> {
    const term = search?.trim();
    const like = term ? ILike(`%${term}%`) : undefined;

    return this.findAndCount({
      where: like
        ? [{ email: like }, { firstName: like }, { lastName: like }]
        : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.update({ id }, { refreshTokenHash });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}
