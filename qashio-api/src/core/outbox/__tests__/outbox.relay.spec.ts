import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource, EntityManager, FindOperator } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';
import { OutboxPublisher } from '@/core/outbox/outbox.publisher';
import { OutboxRelay } from '@/core/outbox/outbox.relay';

type UpdateCall = [
  typeof OutboxEvent,
  string | { id: FindOperator<string[]> },
  Record<string, unknown>,
];

const row = (id: string, key = 'user-1', attempts = 0) => ({
  id,
  aggregate_type: 'transaction',
  aggregate_id: `tx-${id}`,
  topic: 'transaction.created',
  message_key: key,
  payload: { eventId: id },
  status: OutboxStatus.PENDING,
  attempts,
  last_error: null,
  next_attempt_at: new Date(),
  created_at: new Date(),
  sent_at: null,
});

const kafkaDown = () =>
  Object.assign(new Error('Connection error: ECONNREFUSED'), {
    name: 'KafkaJSConnectionError',
  });
const tooLarge = () =>
  Object.assign(new Error('message too large'), {
    name: 'KafkaJSProtocolError',
    type: 'MESSAGE_TOO_LARGE',
  });

// SQL fragment the relay stores for a DB-clock timestamp, e.g. "now() + interval '1000 milliseconds'"
const delayOf = (value: unknown): number => {
  const sql = (value as () => string)();
  const match = /interval '(\d+) milliseconds'/.exec(sql);
  if (!match) throw new Error(`not a delay: ${sql}`);
  return Number(match[1]);
};

describe('OutboxRelay', () => {
  const config = {
    relayIntervalMs: 1000,
    batchSize: 3,
    maxAttempts: 3,
    backoffBaseMs: 1000,
    backoffMaxMs: 60000,
  } as ConfigType<typeof outboxConfig>;

  let batches: ReturnType<typeof row>[][];
  const manager = {
    query: jest.fn(() => Promise.resolve(batches.shift() ?? [])),
    update: jest.fn(() => Promise.resolve()),
  };
  const dataSource = {
    transaction: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const publisher = { publish: jest.fn() };
  const registry = {
    addInterval: jest.fn(),
    doesExist: jest.fn(),
    deleteInterval: jest.fn(),
  };
  let relay: OutboxRelay;

  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  const updates = () => manager.update.mock.calls as unknown as UpdateCall[];
  const updateFor = (id: string) =>
    updates().find(([, criteria]) => criteria === id)?.[2];

  beforeEach(() => {
    jest.clearAllMocks();
    batches = [];
    publisher.publish.mockResolvedValue({ partition: 1, baseOffset: '42' });
    relay = new OutboxRelay(
      dataSource as unknown as DataSource,
      publisher as unknown as OutboxPublisher,
      registry as unknown as SchedulerRegistry,
      config,
    );
  });

  it('claims pending, due rows with FOR UPDATE SKIP LOCKED', async () => {
    await relay.tick();

    const [sql, params] = manager.query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(sql).toMatch(/"status" = 'PENDING'/);
    expect(sql).toMatch(/"next_attempt_at" <= now\(\)/);
    expect(sql).toMatch(/ORDER BY o\."created_at"/);
    expect(sql).toMatch(/FOR UPDATE OF o SKIP LOCKED/);
    expect(params).toEqual([config.batchSize]);
  });

  it('marks a published row SENT', async () => {
    batches = [[row('e1')]];

    await relay.tick();

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'e1',
        topic: 'transaction.created',
        messageKey: 'user-1',
        payload: { eventId: 'e1' },
      }),
    );
    const update = updateFor('e1')!;
    expect(update.status).toBe(OutboxStatus.SENT);
    expect((update.sentAt as () => string)()).toBe('now()');
  });

  describe('permanent failure', () => {
    beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0));
    afterEach(() => jest.spyOn(Math, 'random').mockRestore());

    it('counts the attempt and schedules an exponential backoff', async () => {
      publisher.publish.mockRejectedValue(tooLarge());

      batches = [[row('e1', 'user-1', 0)]];
      await relay.tick();
      let update = updateFor('e1')!;
      expect(update.attempts).toBe(1);
      expect(update.lastError).toContain('message too large');
      expect(update.status).toBeUndefined(); // still PENDING
      expect(delayOf(update.nextAttemptAt)).toBe(1000);

      manager.update.mockClear();
      batches = [[row('e1', 'user-1', 1)]];
      await relay.tick();
      update = updateFor('e1')!;
      expect(update.attempts).toBe(2);
      expect(delayOf(update.nextAttemptAt)).toBe(2000);
    });

    it('marks the row FAILED once it reaches max attempts', async () => {
      publisher.publish.mockRejectedValue(tooLarge());
      batches = [[row('e1', 'user-1', config.maxAttempts - 1)]];

      await relay.tick();

      expect(updateFor('e1')).toMatchObject({
        status: OutboxStatus.FAILED,
        attempts: config.maxAttempts,
      });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('FAILED'));
    });
  });

  describe('transient failure (Kafka down)', () => {
    it('keeps attempts, stays PENDING and waits the max backoff', async () => {
      publisher.publish.mockRejectedValue(kafkaDown());
      batches = [[row('e1', 'user-1', 0)]];

      await relay.tick();

      const [[, criteria, update]] = updates();
      expect((criteria as { id: FindOperator<string[]> }).id.value).toEqual([
        'e1',
      ]);
      expect(update.attempts).toBeUndefined();
      expect(update.status).toBeUndefined();
      expect(update.lastError).toContain('KafkaJSConnectionError');
      expect(delayOf(update.nextAttemptAt)).toBe(config.backoffMaxMs);
    });

    it('never turns an event FAILED, however many ticks it fails', async () => {
      publisher.publish.mockRejectedValue(kafkaDown());

      for (let i = 0; i < config.maxAttempts * 5; i++) {
        batches = [[row('e1', 'user-1', 0)]];
        await relay.tick();
      }

      for (const [, , update] of updates()) {
        expect(update.status).toBeUndefined();
        expect(update.attempts).toBeUndefined();
      }
    });

    it('defers the rest of the batch without trying to publish it', async () => {
      publisher.publish
        .mockResolvedValueOnce({ partition: 0, baseOffset: '1' })
        .mockRejectedValue(kafkaDown());
      batches = [[row('e1', 'a'), row('e2', 'b'), row('e3', 'c')]];

      await relay.tick();

      expect(publisher.publish).toHaveBeenCalledTimes(2);
      expect(updateFor('e1')?.status).toBe(OutboxStatus.SENT);
      const deferred = updates().find(([, c]) => typeof c === 'object')!;
      expect((deferred[1] as { id: FindOperator<string[]> }).id.value).toEqual([
        'e2',
        'e3',
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('deferred 2'));
    });

    it('stops draining when Kafka is down, even for a full batch', async () => {
      publisher.publish.mockRejectedValue(kafkaDown());
      batches = [
        [row('e1', 'a'), row('e2', 'b'), row('e3', 'c')],
        [row('e4', 'd')],
      ];

      await relay.tick();

      expect(manager.query).toHaveBeenCalledTimes(1);
    });
  });

  it("skips later rows with a failed row's key, keeping per-user order", async () => {
    publisher.publish.mockImplementation((event: OutboxEvent) =>
      event.id === 'e1'
        ? Promise.reject(tooLarge())
        : Promise.resolve({ partition: 0, baseOffset: '1' }),
    );
    batches = [[row('e1', 'user-1'), row('e2', 'user-2'), row('e3', 'user-1')]];

    await relay.tick();

    const published = publisher.publish.mock.calls.map(
      ([event]: [OutboxEvent]) => event.id,
    );
    expect(published).toEqual(['e1', 'e2']);
    expect(updateFor('e3')).toBeUndefined(); // untouched, still PENDING
  });

  it('skips a tick while the previous one is still running', async () => {
    let finishPublish: () => void = () => undefined;
    publisher.publish.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPublish = () => resolve({ partition: 0, baseOffset: '1' });
        }),
    );
    batches = [[row('e1')]];

    const first = relay.tick();
    await new Promise((resolve) => setImmediate(resolve));
    await relay.tick(); // overlaps: must return without claiming
    finishPublish();
    await first;

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps claiming batches in the same tick while they come back full', async () => {
    batches = [
      [row('e1', 'a'), row('e2', 'b'), row('e3', 'c')],
      [row('e4', 'd'), row('e5', 'e'), row('e6', 'f')],
      [row('e7', 'g')],
    ];

    await relay.tick();

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(publisher.publish).toHaveBeenCalledTimes(7);
  });

  it('logs a tick-level error (e.g. DB down) instead of throwing', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('db down'));

    await expect(relay.tick()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('tick failed'),
      expect.any(String),
    );

    // and the flag is released, so the next tick runs
    await relay.tick();
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('registers its interval from config and removes it on shutdown', () => {
    jest.useFakeTimers();
    try {
      relay.onApplicationBootstrap();
      expect(registry.addInterval).toHaveBeenCalledWith(
        'outbox-relay',
        expect.anything(),
      );

      registry.doesExist.mockReturnValue(true);
      relay.onApplicationShutdown();
      expect(registry.deleteInterval).toHaveBeenCalledWith('outbox-relay');
    } finally {
      const [[, handle]] = registry.addInterval.mock.calls as [
        [string, NodeJS.Timeout],
      ];
      clearInterval(handle);
      jest.useRealTimers();
    }
  });
});
