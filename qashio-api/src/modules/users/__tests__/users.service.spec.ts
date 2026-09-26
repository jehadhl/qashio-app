import { ConflictException, NotFoundException } from '@nestjs/common';
import { verifyPassword } from '@/common/helpers/hash.helper';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/users.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { UsersRepository } from '@/modules/users/users.repository';
import { UsersService } from '@/modules/users/users.service';

describe('UsersService', () => {
  const repo = {
    existsByEmail: jest.fn(),
    create: jest.fn((data: Partial<User>) => Object.assign(new User(), data)),
    save: jest.fn((user: User) =>
      Promise.resolve(Object.assign(user, { id: 'user-1' })),
    ),
    findAllPaginated: jest.fn(),
    findById: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findByIdWithRefreshToken: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
  };
  const service = new UsersService(repo as unknown as UsersRepository);

  const dto = {
    email: 'demo@qashio.com',
    password: 'Secret123',
    firstName: 'Demo',
    lastName: 'User',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('saves a new user with a hashed password and the default role', async () => {
      repo.existsByEmail.mockResolvedValue(false);

      const user = await service.create(dto);

      expect(repo.existsByEmail).toHaveBeenCalledWith('demo@qashio.com');
      expect(user).toMatchObject({
        id: 'user-1',
        email: dto.email,
        firstName: 'Demo',
        role: UserRole.USER,
      });
      expect(user.passwordHash).not.toBe(dto.password);
      await expect(
        verifyPassword(dto.password, user.passwordHash),
      ).resolves.toBe(true);
    });

    it('keeps an explicit role (admin-only endpoints)', async () => {
      repo.existsByEmail.mockResolvedValue(false);

      const user = await service.create({ ...dto, role: UserRole.ADMIN });

      expect(user.role).toBe(UserRole.ADMIN);
    });

    it('rejects an email that is already registered', async () => {
      repo.existsByEmail.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns one page with pagination metadata', async () => {
      const users = [new User(), new User()];
      repo.findAllPaginated.mockResolvedValue([users, 12]);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        search: 'demo',
      } as never);

      expect(repo.findAllPaginated).toHaveBeenCalledWith(2, 5, 'demo');
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toBe(users);
      expect(result.pagination).toMatchObject({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });
  });

  describe('findById', () => {
    it('returns the user', async () => {
      const user = Object.assign(new User(), { id: 'user-1' });
      repo.findById.mockResolvedValue(user);

      await expect(service.findById('user-1')).resolves.toBe(user);
    });

    it('throws NotFound for an unknown id', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('findByEmailWithPassword normalises the email before looking it up', async () => {
    repo.findByEmailWithPassword.mockResolvedValue(null);

    await service.findByEmailWithPassword('  Demo@Qashio.COM ');

    expect(repo.findByEmailWithPassword).toHaveBeenCalledWith(
      'demo@qashio.com',
    );
  });

  it('findByIdWithRefreshToken delegates to the repository', async () => {
    await service.findByIdWithRefreshToken('user-1');

    expect(repo.findByIdWithRefreshToken).toHaveBeenCalledWith('user-1');
  });

  it('setRefreshTokenHash stores the hash, or null to sign out everywhere', async () => {
    await service.setRefreshTokenHash('user-1', 'hash');
    await service.setRefreshTokenHash('user-1', null);

    expect(repo.updateRefreshTokenHash).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'hash',
    );
    expect(repo.updateRefreshTokenHash).toHaveBeenNthCalledWith(
      2,
      'user-1',
      null,
    );
  });
});
