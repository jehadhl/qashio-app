import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { CategoriesService } from '@/modules/categories/categories.service';
import { Category } from '@/modules/categories/entities/category.entity';

describe('CategoriesService', () => {
  const USER = 'user-1';
  const repo = {
    existsByName: jest.fn(),
    create: jest.fn((data: Partial<Category>) =>
      Object.assign(new Category(), data),
    ),
    save: jest.fn((category: Category) =>
      Promise.resolve(Object.assign(category, { id: 'cat-1' })),
    ),
    findAllByUser: jest.fn(),
    findAllPaginated: jest.fn(),
    findOneByIdAndUser: jest.fn(),
  };
  const service = new CategoriesService(
    repo as unknown as CategoriesRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates the category for the user', async () => {
      repo.existsByName.mockResolvedValue(false);

      const category = await service.create(USER, { name: 'Groceries' });

      expect(repo.existsByName).toHaveBeenCalledWith(USER, 'Groceries');
      expect(repo.create).toHaveBeenCalledWith({
        name: 'Groceries',
        userId: USER,
      });
      expect(category).toMatchObject({
        id: 'cat-1',
        name: 'Groceries',
        userId: USER,
      });
    });

    it('rejects a name the user already has', async () => {
      repo.existsByName.mockResolvedValue(true);

      await expect(service.create(USER, { name: 'Groceries' })).rejects.toThrow(
        new ConflictException('Category "Groceries" already exists'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it("findAll returns only the user's categories", async () => {
    const categories = [new Category()];
    repo.findAllByUser.mockResolvedValue(categories);

    await expect(service.findAll(USER)).resolves.toBe(categories);
    expect(repo.findAllByUser).toHaveBeenCalledWith(USER);
  });

  it('findAllForAdmin returns one page with metadata', async () => {
    repo.findAllPaginated.mockResolvedValue([[new Category()], 1]);

    const result = await service.findAllForAdmin({
      page: 1,
      limit: 10,
    } as never);

    expect(repo.findAllPaginated).toHaveBeenCalledWith(1, 10);
    expect(result).toBeInstanceOf(PaginatedResponseDto);
    expect(result.pagination).toMatchObject({
      total: 1,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  describe('findOneOrFail', () => {
    it('returns a category that belongs to the user', async () => {
      const category = Object.assign(new Category(), {
        id: 'cat-1',
        userId: USER,
      });
      repo.findOneByIdAndUser.mockResolvedValue(category);

      await expect(service.findOneOrFail(USER, 'cat-1')).resolves.toBe(
        category,
      );
      expect(repo.findOneByIdAndUser).toHaveBeenCalledWith('cat-1', USER);
    });

    it("throws NotFound for a missing category or another user's", async () => {
      repo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.findOneOrFail(USER, 'cat-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
