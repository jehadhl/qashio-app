import { Test } from '@nestjs/testing';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/modules/users/enums/user-role.enum';
import { UsersController } from '@/modules/users/users.controller';
import { UsersService } from '@/modules/users/users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = { findAll: jest.fn(), findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('GET /users passes the pagination query to the service', async () => {
    const page = { data: [], pagination: {} };
    usersService.findAll.mockResolvedValue(page);
    const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' as const };

    await expect(controller.findAll(query)).resolves.toBe(page);
    expect(usersService.findAll).toHaveBeenCalledWith(query);
  });

  it('GET /users is admin only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findAll)).toEqual([UserRole.ADMIN]);
  });

  it('GET /users/me returns the signed-in user', async () => {
    const user = { id: 'user-1' };
    usersService.findById.mockResolvedValue(user);

    await expect(controller.me('user-1')).resolves.toBe(user);
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
  });

  it('GET /users/me is open to any signed-in user', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController.prototype.me)).toBeUndefined();
  });
});
