import { ILike } from 'typeorm';
import { UsersRepository } from '@/modules/users/users.repository';
import { createQueryBuilderMock, stubDataSource } from '@/common/helpers/repository.mock';

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(() => {
    repo = new UsersRepository(stubDataSource());
  });

  it('existsByEmail checks by email', async () => {
    const existsBy = jest.spyOn(repo, 'existsBy').mockResolvedValue(true);

    await expect(repo.existsByEmail('demo@qashio.com')).resolves.toBe(true);
    expect(existsBy).toHaveBeenCalledWith({ email: 'demo@qashio.com' });
  });

  it('findById looks up by id', async () => {
    const findOneBy = jest.spyOn(repo, 'findOneBy').mockResolvedValue(null);

    await repo.findById('user-1');

    expect(findOneBy).toHaveBeenCalledWith({ id: 'user-1' });
  });

  describe('findAllPaginated', () => {
    it('pages newest first without a search', async () => {
      const findAndCount = jest.spyOn(repo, 'findAndCount').mockResolvedValue([[], 0]);

      await repo.findAllPaginated(3, 20);

      expect(findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 40,
        take: 20,
      });
    });

    it('searches email, first name and last name case-insensitively', async () => {
      const findAndCount = jest.spyOn(repo, 'findAndCount').mockResolvedValue([[], 0]);

      await repo.findAllPaginated(1, 10, '  demo ');

      const like = ILike('%demo%');
      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: [{ email: like }, { firstName: like }, { lastName: like }] }),
      );
    });

    it('ignores a whitespace-only search', async () => {
      const findAndCount = jest.spyOn(repo, 'findAndCount').mockResolvedValue([[], 0]);

      await repo.findAllPaginated(1, 10, '   ');

      expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  it('findByIdWithRefreshToken selects the normally hidden refresh token hash', async () => {
    const user = { id: 'user-1' };
    const qb = createQueryBuilderMock({ getOne: user });
    const createQueryBuilder = jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb as never);

    await expect(repo.findByIdWithRefreshToken('user-1')).resolves.toBe(user);

    expect(createQueryBuilder).toHaveBeenCalledWith('user');
    expect(qb.addSelect).toHaveBeenCalledWith('user.refreshTokenHash');
    expect(qb.where).toHaveBeenCalledWith('user.id = :id', { id: 'user-1' });
  });

  it('findByEmailWithPassword selects the normally hidden password hash', async () => {
    const qb = createQueryBuilderMock();
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb as never);

    await repo.findByEmailWithPassword('demo@qashio.com');

    expect(qb.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(qb.where).toHaveBeenCalledWith('user.email = :email', { email: 'demo@qashio.com' });
  });

  it('updateRefreshTokenHash updates only that column', async () => {
    const update = jest.spyOn(repo, 'update').mockResolvedValue({} as never);

    await repo.updateRefreshTokenHash('user-1', null);

    expect(update).toHaveBeenCalledWith({ id: 'user-1' }, { refreshTokenHash: null });
  });
});
