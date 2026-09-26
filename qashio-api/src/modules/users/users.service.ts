import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { hashPassword } from '@/common/helpers/hash.helper';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { User } from '@/modules/users/entities/users.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { UsersRepository } from '@/modules/users/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const emailTaken = await this.usersRepository.existsByEmail(dto.email);
    if (emailTaken) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.usersRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? UserRole.USER,
      passwordHash: await hashPassword(dto.password),
    });
    return this.usersRepository.save(user);
  }

  // Admin-only (guarded by @Roles(UserRole.ADMIN) on the route).
  async findAll({ page, limit, search }: PaginationDto): Promise<PaginatedResponseDto<User>> {
    const [users, total] = await this.usersRepository.findAllPaginated(page, limit, search);
    return new PaginatedResponseDto(users, page, limit, total);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email.trim().toLowerCase());
  }

  findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.usersRepository.findByIdWithRefreshToken(id);
  }

  // null signs the user out everywhere (the stored refresh token no longer matches).
  setRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    return this.usersRepository.updateRefreshTokenHash(id, refreshTokenHash);
  }
}