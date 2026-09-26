// End-to-end: every module (auth, users, categories, transactions, budgets) through the
// real AppModule and HTTP stack (validation, guards, error filter, response envelope)
// against a real PostgreSQL test database built by the real migrations.
// Only Kafka is replaced, by a fake client that records the events the API publishes.
//
// Needs Postgres (docker compose up -d postgres). Uses <DATABASE_URL db>_test, or E2E_DATABASE_URL.
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request = require('supertest');
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { configureApp } from '@/core/app.setup';
import { KAFKA_CLIENT, KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import { prepareTestDatabase, truncateAll } from './test-db';

interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

describe('Qashio API (e2e)', () => {
  let app: NestExpressApplication;
  const kafka = {
    emit: jest.fn(() => of([{ topicName: 'topic', partition: 0, baseOffset: '0' }])),
    connect: jest.fn(),
    close: jest.fn(),
  };

  const api = () => request(app.getHttpServer() as App);
  const auth = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

  const register = async (email: string, password = 'Secret123'): Promise<Session> => {
    const res = await api()
      .post('/api/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(201);
    const { user, tokens } = res.body.data;
    return { userId: user.id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  };

  const createCategory = async (session: Session, name: string): Promise<string> => {
    const res = await api().post('/api/categories').set(auth(session)).send({ name }).expect(201);
    return res.body.data.id;
  };

  // "Now" minus a few seconds: inside the current week/month/year for budget usage.
  const recently = () => new Date(Date.now() - 5_000).toISOString();

  const transaction = (categoryId: string, overrides: Record<string, unknown> = {}) => ({
    amount: 100,
    type: 'expense',
    status: 'completed',
    date: recently(),
    categoryId,
    counterparty: 'Acme Corp',
    reference: 'INV-1',
    narration: 'Test transaction',
    ...overrides,
  });

  const createTransaction = async (session: Session, body: Record<string, unknown>) =>
    (await api().post('/api/transactions').set(auth(session)).send(body).expect(201)).body.data;

  beforeAll(async () => {
    await prepareTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KAFKA_CLIENT)
      .useValue(kafka)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    // Same HTTP setup as main.ts; CORS, compression and request logging are production
    // extras that don't change responses, so they're left off here.
    configureApp(app, { isProd: false });
    await app.init();

    await truncateAll(app.get(DataSource));
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => kafka.emit.mockClear());

  describe('HTTP basics', () => {
    it('wraps errors in the standard error shape', async () => {
      const res = await api().get('/api/does-not-exist').expect(404);

      expect(res.body).toMatchObject({ success: false, statusCode: 404, path: '/api/does-not-exist' });
      expect(res.body.timestamp).toEqual(expect.any(String));
    });

    it('sends security headers (helmet)', async () => {
      const res = await api().get('/api/users/me');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('rejects protected routes without a token', async () => {
      const res = await api().get('/api/transactions').expect(401);

      expect(res.body).toMatchObject({ success: false, statusCode: 401 });
    });

    it('rejects a malformed token', async () => {
      await api().get('/api/transactions').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });
  });

  describe('Auth', () => {
    it('registers: returns the user (no secrets) and a token pair', async () => {
      const res = await api()
        .post('/api/auth/register')
        .send({ email: 'Alice@Example.com ', password: 'Secret123', firstName: ' Alice ', lastName: 'Smith' })
        .expect(201);

      expect(res.body.success).toBe(true);
      const { user, tokens } = res.body.data;
      expect(user).toMatchObject({ email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith', role: 'user' });
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('refreshTokenHash');
      expect(tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: '15m' });
      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(tokens.refreshToken).not.toBe(tokens.accessToken);
    });

    it('rejects a duplicate email (case-insensitive)', async () => {
      const res = await api()
        .post('/api/auth/register')
        .send({ email: 'ALICE@example.com', password: 'Secret123', firstName: 'Alice', lastName: 'Again' })
        .expect(409);

      expect(res.body.message).toBe('Email is already registered');
    });

    it('validates the body and lists every invalid field', async () => {
      const res = await api()
        .post('/api/auth/register')
        .send({ email: 'nope', password: 'short', firstName: 'A', lastName: 'B', role: 'admin' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      // role is rejected: public sign-up can't choose admin.
      expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'firstName', 'lastName', 'role']));
    });

    it('logs in with any email casing', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: ' ALICE@EXAMPLE.COM', password: 'Secret123' })
        .expect(200);

      expect(res.body.data.user.email).toBe('alice@example.com');
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await api()
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'Wrong1234' })
        .expect(401);
      const unknownEmail = await api()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Secret123' })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('rotates refresh tokens and treats reuse of an old one as theft', async () => {
      const session = await register('rotate@example.com');

      const first = await api().post('/api/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
      const newPair = first.body.data;
      expect(newPair.refreshToken).not.toBe(session.refreshToken);
      await api().get('/api/users/me').set('Authorization', `Bearer ${newPair.accessToken}`).expect(200);

      // Replaying the old token fails and revokes the whole session...
      await api().post('/api/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      // ...so even the newest refresh token stops working.
      await api().post('/api/auth/refresh').send({ refreshToken: newPair.refreshToken }).expect(401);
    });

    it('does not accept an access token as a refresh token, or the reverse', async () => {
      const session = await register('types@example.com');

      await api().post('/api/auth/refresh').send({ refreshToken: session.accessToken }).expect(401);
      await api().get('/api/users/me').set('Authorization', `Bearer ${session.refreshToken}`).expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const session = await register('logout@example.com');

      await api().post('/api/auth/logout').set(auth(session)).expect(204);

      await api().post('/api/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    });
  });

  describe('Users', () => {
    it('GET /users/me returns the signed-in user', async () => {
      const session = await register('me@example.com');

      const res = await api().get('/api/users/me').set(auth(session)).expect(200);

      expect(res.body.data).toMatchObject({ id: session.userId, email: 'me@example.com' });
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('GET /users is admin only', async () => {
      const session = await register('not-admin@example.com');

      const res = await api().get('/api/users').set(auth(session)).expect(403);

      expect(res.body.message).toBe('You do not have permission to do this');
    });
  });

  describe('Categories', () => {
    let alice: Session;
    let bob: Session;

    beforeAll(async () => {
      alice = await register('cat-alice@example.com');
      bob = await register('cat-bob@example.com');
    });

    it('creates a category (name trimmed, owner hidden)', async () => {
      const res = await api().post('/api/categories').set(auth(alice)).send({ name: '  Rent  ' }).expect(201);

      expect(res.body.data).toMatchObject({ id: expect.any(String), name: 'Rent' });
      expect(res.body.data).not.toHaveProperty('userId');
    });

    it('rejects a duplicate name for the same user, but not for another user', async () => {
      await api().post('/api/categories').set(auth(alice)).send({ name: 'Rent' }).expect(409);
      await api().post('/api/categories').set(auth(bob)).send({ name: 'Rent' }).expect(201);
    });

    it('rejects an empty name', async () => {
      await api().post('/api/categories').set(auth(alice)).send({ name: '   ' }).expect(400);
    });

    it("lists only the user's own categories, alphabetically", async () => {
      await createCategory(alice, 'Groceries');

      const res = await api().get('/api/categories').set(auth(alice)).expect(200);

      expect(res.body.data.map((c: { name: string }) => c.name)).toEqual(['Groceries', 'Rent']);
      const bobs = await api().get('/api/categories').set(auth(bob)).expect(200);
      expect(bobs.body.data.map((c: { name: string }) => c.name)).toEqual(['Rent']);
    });

    it('GET /categories/all is admin only', async () => {
      await api().get('/api/categories/all').set(auth(alice)).expect(403);
    });
  });

  describe('Transactions', () => {
    let alice: Session;
    let bob: Session;
    let salary: string;
    let groceries: string;
    let rent: string;
    let bobsCategory: string;

    beforeAll(async () => {
      alice = await register('tx-alice@example.com');
      bob = await register('tx-bob@example.com');
      salary = await createCategory(alice, 'Salary');
      groceries = await createCategory(alice, 'Groceries');
      rent = await createCategory(alice, 'Rent');
      bobsCategory = await createCategory(bob, 'Bob only');
    });

    describe('create', () => {
      it('creates it, returns it with its category, and publishes transaction.created', async () => {
        const res = await api()
          .post('/api/transactions')
          .set(auth(alice))
          .send(transaction(groceries, { amount: 42.5, counterparty: 'Fresh Market' }))
          .expect(201);

        expect(res.body.data).toMatchObject({
          id: expect.any(String),
          amount: 42.5,
          type: 'expense',
          status: 'completed',
          counterparty: 'Fresh Market',
          category: { id: groceries, name: 'Groceries' },
        });
        expect(res.body.data).not.toHaveProperty('userId');

        expect(kafka.emit).toHaveBeenCalledWith(KAFKA_TOPICS.TRANSACTION_CREATED, {
          key: alice.userId,
          value: expect.objectContaining({
            transactionId: res.body.data.id,
            userId: alice.userId,
            categoryId: groceries,
            amount: 42.5,
            type: 'expense',
            status: 'completed',
          }),
        });
      });

      it("rejects another user's category", async () => {
        const res = await api()
          .post('/api/transactions')
          .set(auth(alice))
          .send(transaction(bobsCategory))
          .expect(404);

        expect(res.body.message).toBe('Category not found');
        expect(kafka.emit).not.toHaveBeenCalled();
      });

      it('rejects unknown fields, bad enums, bad amounts and missing required fields', async () => {
        const bad = [
          transaction(groceries, { userId: bob.userId }),
          transaction(groceries, { type: 'transfer' }),
          transaction(groceries, { status: undefined }),
          transaction(groceries, { amount: 10.123 }),
          transaction(groceries, { amount: -5 }),
          transaction(groceries, { reference: undefined }),
          transaction(groceries, { narration: undefined }),
          transaction(groceries, { categoryId: 'not-a-uuid' }),
        ];

        for (const body of bad) {
          const res = await api().post('/api/transactions').set(auth(alice)).send(body);
          expect({ body, status: res.status }).toEqual({ body, status: 400 });
        }
        expect(kafka.emit).not.toHaveBeenCalled();
      });
    });

    describe('list: pagination, filters, sorting', () => {
      beforeAll(async () => {
        // Replace whatever the create tests added with a known set.
        const existing = await api().get('/api/transactions?limit=100').set(auth(alice));
        for (const tx of existing.body.data) {
          await api().delete(`/api/transactions/${tx.id}`).set(auth(alice)).expect(204);
        }

        await createTransaction(alice, transaction(salary, { type: 'income', amount: 5000, counterparty: 'Employer Ltd', reference: 'SAL-9' }));
        await createTransaction(alice, transaction(groceries, { amount: 120.5, counterparty: 'Acme Foods', narration: '50% off week' }));
        await createTransaction(alice, transaction(groceries, { amount: 30, status: 'pending', counterparty: 'Corner Shop' }));
        await createTransaction(alice, transaction(rent, { amount: 1500, counterparty: 'Landlord', date: '2026-01-15T10:00:00.000Z' }));
      });

      const list = (query: string, session?: Session) =>
        api()
          .get(`/api/transactions${query}`)
          .set(auth(session ?? alice))
          .expect(200)
          .then((res) => res.body);

      const counterparties = (body: { data: { counterparty: string }[] }) => body.data.map((t) => t.counterparty);

      it('paginates, newest first by default', async () => {
        const page1 = await list('?limit=2&page=1');
        const page2 = await list('?limit=2&page=2');

        expect(page1.pagination).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2, hasNextPage: true, hasPrevPage: false });
        expect(page1.data).toHaveLength(2);
        expect(page2.data).toHaveLength(2);
        const dates = [...page1.data, ...page2.data].map((t: { date: string }) => t.date);
        expect(dates).toEqual([...dates].sort().reverse());
        expect(page2.data.at(-1).counterparty).toBe('Landlord'); // the January one
      });

      it('filters by type, status and category', async () => {
        expect(counterparties(await list('?type=income'))).toEqual(['Employer Ltd']);
        expect(counterparties(await list('?status=pending'))).toEqual(['Corner Shop']);
        expect((await list(`?categoryId=${groceries}`)).pagination.total).toBe(2);
      });

      it('filters by date range (end date inclusive)', async () => {
        expect(counterparties(await list('?startDate=2026-01-01&endDate=2026-01-15'))).toEqual(['Landlord']);
      });

      it('searches reference, counterparty and narration; % is matched literally', async () => {
        expect(counterparties(await list('?search=acme'))).toEqual(['Acme Foods']);
        expect((await list('?search=SAL-9')).pagination.total).toBe(1);
        expect((await list(`?search=${encodeURIComponent('50%')}`)).pagination.total).toBe(1);
        expect((await list(`?search=${encodeURIComponent('%')}`)).pagination.total).toBe(1);
      });

      it('sorts by amount', async () => {
        const asc = await list('?sortBy=amount&sortOrder=asc');

        expect(asc.data.map((t: { amount: number }) => t.amount)).toEqual([30, 120.5, 1500, 5000]);
      });

      it('rejects unsupported sort fields and bad filter values', async () => {
        await api().get('/api/transactions?sortBy=reference').set(auth(alice)).expect(400);
        await api().get('/api/transactions?status=bogus').set(auth(alice)).expect(400);
        await api().get('/api/transactions?limit=1000').set(auth(alice)).expect(400);
        await api().get('/api/transactions?unknown=1').set(auth(alice)).expect(400);
      });

      it("never shows another user's transactions", async () => {
        expect((await list('', bob)).pagination.total).toBe(0);
      });
    });

    describe('get, update (PUT), delete', () => {
      let id: string;

      beforeAll(async () => {
        id = (await createTransaction(alice, transaction(groceries, { amount: 75, reference: 'INV-GET' }))).id;
      });

      it('gets one', async () => {
        const res = await api().get(`/api/transactions/${id}`).set(auth(alice)).expect(200);

        expect(res.body.data).toMatchObject({ id, amount: 75, reference: 'INV-GET', category: { id: groceries } });
      });

      it("returns 404 for another user's transaction and 400 for a non-UUID id", async () => {
        await api().get(`/api/transactions/${id}`).set(auth(bob)).expect(404);
        await api().get('/api/transactions/123').set(auth(alice)).expect(400);
      });

      it('PUT replaces every field, can move category, and publishes transaction.updated', async () => {
        const body = transaction(rent, {
          amount: 80.25,
          type: 'income',
          status: 'failed',
          counterparty: 'Refund Co',
          reference: 'INV-PUT',
          narration: 'Changed',
        });

        const res = await api().put(`/api/transactions/${id}`).set(auth(alice)).send(body).expect(200);

        expect(res.body.data).toMatchObject({
          id,
          amount: 80.25,
          type: 'income',
          status: 'failed',
          counterparty: 'Refund Co',
          reference: 'INV-PUT',
          narration: 'Changed',
          category: { id: rent, name: 'Rent' },
        });
        expect(kafka.emit).toHaveBeenCalledWith(
          KAFKA_TOPICS.TRANSACTION_UPDATED,
          expect.objectContaining({ key: alice.userId, value: expect.objectContaining({ transactionId: id }) }),
        );

        const reloaded = await api().get(`/api/transactions/${id}`).set(auth(alice)).expect(200);
        expect(reloaded.body.data.amount).toBe(80.25);
      });

      it('PUT requires the whole transaction', async () => {
        await api().put(`/api/transactions/${id}`).set(auth(alice)).send({ amount: 10 }).expect(400);
      });

      it("PUT can't touch another user's transaction", async () => {
        await api().put(`/api/transactions/${id}`).set(auth(bob)).send(transaction(bobsCategory)).expect(404);
      });

      it("DELETE removes it (404 for others), then it's gone", async () => {
        await api().delete(`/api/transactions/${id}`).set(auth(bob)).expect(404);

        await api().delete(`/api/transactions/${id}`).set(auth(alice)).expect(204);

        await api().get(`/api/transactions/${id}`).set(auth(alice)).expect(404);
      });
    });
  });

  describe('Budgets', () => {
    let alice: Session;
    let bob: Session;
    let dining: string;
    let monthlyId: string;

    beforeAll(async () => {
      alice = await register('budget-alice@example.com');
      bob = await register('budget-bob@example.com');
      dining = await createCategory(alice, 'Dining');
      const other = await createCategory(alice, 'Other');

      // Counted: completed expenses in Dining this period.
      await createTransaction(alice, transaction(dining, { amount: 120.5 }));
      await createTransaction(alice, transaction(dining, { amount: 29.5 }));
      // Not counted: pending, income, another category, a previous year.
      await createTransaction(alice, transaction(dining, { amount: 1000, status: 'pending' }));
      await createTransaction(alice, transaction(dining, { amount: 1000, type: 'income' }));
      await createTransaction(alice, transaction(other, { amount: 1000 }));
      await createTransaction(alice, transaction(dining, { amount: 1000, date: '2020-01-01T00:00:00.000Z' }));
    });

    it('creates a budget and reports current spending (completed expenses only)', async () => {
      const res = await api()
        .post('/api/budgets')
        .set(auth(alice))
        .send({ categoryId: dining, amount: 200, period: 'monthly' })
        .expect(201);

      monthlyId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        amount: 200,
        period: 'monthly',
        category: { id: dining, name: 'Dining' },
        spent: 150,
        remaining: 50,
        percentage: 75,
        isExceeded: false,
      });
      expect(new Date(res.body.data.periodStart).getUTCDate()).toBe(1);
    });

    it('allows one budget per category per period', async () => {
      await api().post('/api/budgets').set(auth(alice)).send({ categoryId: dining, amount: 300, period: 'monthly' }).expect(409);
      await api().post('/api/budgets').set(auth(alice)).send({ categoryId: dining, amount: 80, period: 'weekly' }).expect(201);
    });

    it('validates the body', async () => {
      await api().post('/api/budgets').set(auth(alice)).send({ categoryId: dining, amount: 0, period: 'daily' }).expect(400);
    });

    it("rejects another user's category", async () => {
      await api().post('/api/budgets').set(auth(bob)).send({ categoryId: dining, amount: 100, period: 'monthly' }).expect(404);
    });

    it('lists budgets with usage; a new expense can push one over', async () => {
      await createTransaction(alice, transaction(dining, { amount: 70 }));

      const res = await api().get('/api/budgets').set(auth(alice)).expect(200);

      const monthly = res.body.data.find((b: { id: string }) => b.id === monthlyId);
      expect(monthly).toMatchObject({ spent: 220, remaining: -20, percentage: 110, isExceeded: true });
      expect(res.body.data).toHaveLength(2);
      expect((await api().get('/api/budgets').set(auth(bob)).expect(200)).body.data).toEqual([]);
    });

    it('updates amount and period (no clash with an existing period)', async () => {
      await api().put(`/api/budgets/${monthlyId}`).set(auth(alice)).send({ amount: 500, period: 'weekly' }).expect(409);

      const res = await api()
        .put(`/api/budgets/${monthlyId}`)
        .set(auth(alice))
        .send({ amount: 500, period: 'yearly' })
        .expect(200);

      expect(res.body.data).toMatchObject({ amount: 500, period: 'yearly', spent: 220, isExceeded: false });
    });

    it('hides budgets from other users and deletes them', async () => {
      await api().get(`/api/budgets/${monthlyId}`).set(auth(bob)).expect(404);

      await api().delete(`/api/budgets/${monthlyId}`).set(auth(alice)).expect(204);

      await api().get(`/api/budgets/${monthlyId}`).set(auth(alice)).expect(404);
    });
  });
});
