// Integration: the outbox against a real PostgreSQL test database built by the real
// migrations. Checks what mocks can't: the atomic insert, FOR UPDATE SKIP LOCKED under
// concurrent relays, the processed_events primary key, and what cleanup really deletes.
// Kafka is replaced by a fake client that records what the relay publishes.
//
// Needs Postgres (docker compose up -d postgres). Uses <DATABASE_URL db>_test, or E2E_DATABASE_URL.
import type { ConfigType } from '@nestjs/config';
import { KafkaContext } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Observable, of } from 'rxjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { KAFKA_CLIENT, KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import outboxConfig from '@/core/outbox/outbox.config';
import { OutboxCleanup } from '@/core/outbox/outbox.cleanup';
import { OutboxPublisher } from '@/core/outbox/outbox.publisher';
import { OutboxRelay } from '@/core/outbox/outbox.relay';
import { OutboxService } from '@/core/outbox/outbox.service';
import { BudgetEventsConsumer } from '@/modules/budgets/consumers/budget-events.consumer';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import {
  TransactionStatus,
  TransactionType,
} from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';
import { prepareTestDatabase, truncateAll } from './test-db';

interface KafkaMessage {
  key: string;
  value: { eventId: string };
  headers: Record<string, string>;
}

interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  topic: string;
  message_key: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

describe('Outbox (integration)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  // Keeps the httpOnly auth cookies between requests
  let agent: ReturnType<typeof request.agent>;
  let userId: string;
  let categoryId: string;

  // Acks after a short delay, so concurrent relays really overlap while publishing
  const kafka = {
    emit: jest.fn<Observable<unknown>, [string, KafkaMessage]>(
      () =>
        new Observable((subscriber) => {
          const timer = setTimeout(() => {
            subscriber.next([
              { topicName: 'topic', partition: 0, baseOffset: '0' },
            ]);
            subscriber.complete();
          }, 5);
          return () => clearTimeout(timer);
        }),
    ),
    connect: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
  };

  const outboxRows = (where = 'TRUE', params: unknown[] = []) =>
    dataSource.query<OutboxRow[]>(
      `SELECT * FROM "outbox_events" WHERE ${where} ORDER BY "created_at"`,
      params,
    );

  beforeAll(async () => {
    await prepareTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KAFKA_CLIENT)
      .useValue(kafka)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = app.get(DataSource);
    await truncateAll(dataSource);

    agent = request.agent(app.getHttpServer());
    const registered = await agent
      .post('/api/auth/register')
      .send({
        email: 'outbox@example.com',
        password: 'Secret123',
        firstName: 'Out',
        lastName: 'Box',
      })
      .expect(201);
    userId = registered.body.data.user.id;

    const category = await agent
      .post('/api/categories')
      .send({ name: 'Groceries' })
      .expect(201);
    categoryId = category.body.data.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE "outbox_events", "processed_events"');
    jest.clearAllMocks();
  });

  it('creating a transaction writes exactly one PENDING outbox row with the event', async () => {
    const res = await agent
      .post('/api/transactions')
      .send({
        amount: 42.5,
        type: 'expense',
        status: 'completed',
        date: new Date().toISOString(),
        categoryId,
        counterparty: 'Fresh Market',
        reference: 'INV-1',
        narration: 'Weekly shop',
      })
      .expect(201);
    const transactionId: string = res.body.data.id;

    const rows = await outboxRows();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      aggregate_type: 'transaction',
      aggregate_id: transactionId,
      topic: KAFKA_TOPICS.TRANSACTION_CREATED,
      message_key: userId,
      status: 'PENDING',
      attempts: 0,
    });
    expect(row.payload).toMatchObject({
      eventId: row.id,
      transactionId,
      userId,
      categoryId,
      amount: 42.5,
      type: 'expense',
      status: 'completed',
    });
    // Nothing reaches Kafka from the HTTP path
    expect(kafka.emit).not.toHaveBeenCalled();
  });

  it('two relays running concurrently publish each row exactly once (SKIP LOCKED)', async () => {
    const outbox = app.get(OutboxService);
    const total = 30;
    await dataSource.transaction(async (manager) => {
      for (let i = 0; i < total; i++) {
        const id = randomUUID();
        await outbox.add(manager, {
          id,
          aggregateType: 'transaction',
          aggregateId: randomUUID(),
          topic: KAFKA_TOPICS.TRANSACTION_CREATED,
          // distinct keys, so per-key ordering never holds a row back
          messageKey: randomUUID(),
          payload: { eventId: id },
        });
      }
    });

    // Two independent relays (as if two API instances), with small batches so each
    // tick claims several batches and the two really compete for rows
    const config: ConfigType<typeof outboxConfig> = {
      ...app.get<ConfigType<typeof outboxConfig>>(outboxConfig.KEY),
      batchSize: 4,
    };
    const makeRelay = () =>
      new OutboxRelay(
        dataSource,
        app.get(OutboxPublisher),
        app.get(SchedulerRegistry),
        config,
      );

    await Promise.all([makeRelay().tick(), makeRelay().tick()]);

    const published = kafka.emit.mock.calls.map(
      ([, message]) => message.headers['event-id'],
    );
    expect(published).toHaveLength(total);
    expect(new Set(published).size).toBe(total);

    const rows = await outboxRows();
    expect(rows.every((row) => row.status === 'SENT')).toBe(true);
  });

  it('the same event delivered twice is processed once', async () => {
    const consumer = app.get(BudgetEventsConsumer);
    const checkUsage = jest.spyOn(
      app.get(BudgetsService),
      'checkUsageForCategory',
    );
    const event: TransactionEventPayload = {
      eventId: randomUUID(),
      transactionId: randomUUID(),
      userId,
      categoryId,
      amount: 10,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.COMPLETED,
      date: new Date().toISOString(),
      occurredAt: new Date().toISOString(),
    };
    const context = (offset: string) =>
      ({
        getTopic: () => KAFKA_TOPICS.TRANSACTION_CREATED,
        getPartition: () => 0,
        getMessage: () => ({ offset }),
      }) as unknown as KafkaContext;

    await consumer.onTransactionCreated(event, context('1'));
    await consumer.onTransactionCreated(event, context('2')); // redelivery

    const processed = await dataSource.query<{ consumer: string }[]>(
      'SELECT "consumer" FROM "processed_events" WHERE "event_id" = $1',
      [event.eventId],
    );
    expect(processed).toEqual([{ consumer: 'budget-consumer' }]);
    expect(checkUsage).toHaveBeenCalledTimes(1);
    checkUsage.mockRestore();
  });

  it('cleanup removes old SENT rows and processed events, never PENDING or FAILED', async () => {
    const old = "now() - interval '30 days'";
    const insert = (status: string, sentAt: string | null) =>
      dataSource.query<{ id: string }[]>(
        `INSERT INTO "outbox_events"
           ("id", "aggregate_type", "aggregate_id", "topic", "message_key", "payload",
            "status", "created_at", "next_attempt_at", "sent_at")
         VALUES ($1, 'transaction', $2, 'transaction.created', 'k', '{}',
                 $3, ${old}, ${old}, ${sentAt ?? 'NULL'})
         RETURNING "id"`,
        [randomUUID(), randomUUID(), status],
      );
    await insert('SENT', old);
    await insert('SENT', 'now()'); // recent: kept
    await insert('PENDING', null);
    await insert('FAILED', null);
    await dataSource.query(
      `INSERT INTO "processed_events" ("event_id", "consumer", "processed_at")
       VALUES ($1, 'budget-consumer', ${old}), ($2, 'budget-consumer', now())`,
      [randomUUID(), randomUUID()],
    );

    await app.get(OutboxCleanup).cleanup();

    const rows = await outboxRows();
    expect(rows.map((row) => row.status).sort()).toEqual([
      'FAILED',
      'PENDING',
      'SENT',
    ]);
    const [{ count }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS "count" FROM "processed_events"',
    );
    expect(count).toBe(1);
  });

  it('a relay tick publishes a pending row with its eventId header and marks it SENT', async () => {
    kafka.emit.mockImplementationOnce(() =>
      of([{ topicName: 'topic', partition: 1, baseOffset: '7' }]),
    );
    const outbox = app.get(OutboxService);
    const id = await dataSource.transaction((manager) =>
      outbox.add(manager, {
        aggregateType: 'transaction',
        aggregateId: randomUUID(),
        topic: KAFKA_TOPICS.TRANSACTION_UPDATED,
        messageKey: userId,
        payload: { hello: 'world' },
      }),
    );

    await app.get(OutboxRelay).tick();

    expect(kafka.emit).toHaveBeenCalledWith(KAFKA_TOPICS.TRANSACTION_UPDATED, {
      key: userId,
      value: { hello: 'world' },
      headers: { 'event-id': id },
    });
    const [row] = await dataSource.query<{ status: string; sent_at: Date }[]>(
      'SELECT "status", "sent_at" FROM "outbox_events" WHERE "id" = $1',
      [id],
    );
    expect(row.status).toBe('SENT');
    expect(row.sent_at).toBeInstanceOf(Date);
  });
});
