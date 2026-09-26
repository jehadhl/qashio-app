import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { stubDataSource } from '@/common/helpers/repository.mock';

describe('CategoriesRepository', () => {
  let repo: CategoriesRepository;

  beforeEach(() => {
    repo = new CategoriesRepository(stubDataSource());
  });

  it("findAllByUser returns the user's categories alphabetically", async () => {
    const find = jest.spyOn(repo, 'find').mockResolvedValue([]);

    await repo.findAllByUser('user-1');

    expect(find).toHaveBeenCalledWith({ where: { userId: 'user-1' }, order: { name: 'ASC' } });
  });

  it('findAllPaginated pages across all users', async () => {
    const findAndCount = jest.spyOn(repo, 'findAndCount').mockResolvedValue([[], 0]);

    await repo.findAllPaginated(2, 25);

    expect(findAndCount).toHaveBeenCalledWith({
      order: { name: 'ASC', createdAt: 'DESC' },
      skip: 25,
      take: 25,
    });
  });

  it('findOneByIdAndUser scopes the lookup to the owner', async () => {
    const findOneBy = jest.spyOn(repo, 'findOneBy').mockResolvedValue(null);

    await repo.findOneByIdAndUser('cat-1', 'user-1');

    expect(findOneBy).toHaveBeenCalledWith({ id: 'cat-1', userId: 'user-1' });
  });

  it('existsByName checks the name within one user', async () => {
    const existsBy = jest.spyOn(repo, 'existsBy').mockResolvedValue(false);

    await expect(repo.existsByName('user-1', 'Rent')).resolves.toBe(false);
    expect(existsBy).toHaveBeenCalledWith({ userId: 'user-1', name: 'Rent' });
  });
});
