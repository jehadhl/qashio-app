import { Test } from '@nestjs/testing';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { CategoriesService } from '@/modules/categories/categories.service';
import { UserRole } from '@/modules/users/enums/user-role.enum';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  const categoriesService = { create: jest.fn(), findAll: jest.fn(), findAllForAdmin: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: categoriesService }],
    }).compile();
    controller = moduleRef.get(CategoriesController);
  });

  it('POST /categories creates it for the signed-in user', async () => {
    const category = { id: 'cat-1', name: 'Rent' };
    categoriesService.create.mockResolvedValue(category);

    await expect(controller.create('user-1', { name: 'Rent' })).resolves.toBe(category);
    expect(categoriesService.create).toHaveBeenCalledWith('user-1', { name: 'Rent' });
  });

  it("GET /categories lists the signed-in user's categories", async () => {
    categoriesService.findAll.mockResolvedValue([]);

    await controller.findAll('user-1');

    expect(categoriesService.findAll).toHaveBeenCalledWith('user-1');
  });

  it('GET /categories/all passes the query through and is admin only', async () => {
    const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' as const };

    await controller.findAllForAdmin(query);

    expect(categoriesService.findAllForAdmin).toHaveBeenCalledWith(query);
    expect(Reflect.getMetadata(ROLES_KEY, CategoriesController.prototype.findAllForAdmin)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CategoriesController.prototype.findAll)).toBeUndefined();
  });
});
