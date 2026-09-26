import AppDataSource from '@/core/database/data-source';
import { hashPassword } from '@/common/helpers/hash.helper';
import { Category } from '@/modules/categories/entities/category.entity';
import { User } from '@/modules/users/entities/users.entity';
import { UserRole } from '@/modules/users/enums/user-role.enum';

// Override with SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD. Development only.
const DEMO_USER = {
  email: (process.env.SEED_DEMO_EMAIL ?? 'demo@qashio.com').trim().toLowerCase(),
  password: process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345',
  firstName: 'Demo',
  lastName: 'User',
};

const DEMO_CATEGORIES = [
  'Salary',
  'Groceries',
  'Rent',
  'Utilities',
  'Transport',
  'Dining Out',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'IT Services',
];

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }

  await AppDataSource.initialize();

  try {
    await AppDataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      let user = await users.findOne({ where: { email: DEMO_USER.email } });

      if (user) {
        console.log(`Demo user already exists: ${DEMO_USER.email}`);
      } else {
        user = await users.save(
          users.create({
            email: DEMO_USER.email,
            passwordHash: await hashPassword(DEMO_USER.password),
            firstName: DEMO_USER.firstName,
            lastName: DEMO_USER.lastName,
            role: UserRole.USER,
          }),
        );
        console.log(`Created demo user: ${DEMO_USER.email}`);
      }

      // ON CONFLICT DO NOTHING on (user_id, name): re-running never duplicates.
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(Category)
        .values(DEMO_CATEGORIES.map((name) => ({ name, userId: user.id })))
        .orIgnore()
        .execute();

      const added = result.identifiers.filter(Boolean).length;
      console.log(`Categories: ${added} added, ${DEMO_CATEGORIES.length - added} already there`);
    });

    console.log(`\nLog in with ${DEMO_USER.email} / ${DEMO_USER.password}`);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
