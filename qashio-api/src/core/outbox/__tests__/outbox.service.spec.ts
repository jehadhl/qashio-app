import { EntityManager } from 'typeorm';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';
import { IdempotencyService } from '@/core/outbox/idempotency.service';
import { OutboxService } from '@/core/outbox/outbox.service';

describe('OutboxService', () => {
  const manager = { insert: jest.fn() };
  const service = new OutboxService();

  const input = {
    aggregateType: 'transaction',
    aggregateId: 'tx-1',
    topic: 'transaction.created',
    messageKey: 'user-1',
    payload: { amount: 100 },
  };

  beforeEach(() => jest.clearAllMocks());

  it('inserts through the given manager and returns the provided id', async () => {
    const id = await service.add(manager as unknown as EntityManager, {
      ...input,
      id: 'evt-1',
    });

    expect(id).toBe('evt-1');
    expect(manager.insert).toHaveBeenCalledWith(OutboxEvent, {
      id: 'evt-1',
      ...input,
    });
  });

  it('generates a UUID when no id is given', async () => {
    const id = await service.add(manager as unknown as EntityManager, input);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('IdempotencyService', () => {
  const manager = { query: jest.fn() };
  const service = new IdempotencyService();

  beforeEach(() => jest.clearAllMocks());

  it('returns true the first time (row inserted)', async () => {
    manager.query.mockResolvedValue([{ event_id: 'evt-1' }]);

    await expect(
      service.markProcessed(
        manager as unknown as EntityManager,
        'evt-1',
        'budget-consumer',
      ),
    ).resolves.toBe(true);

    const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(sql).toMatch(/RETURNING "event_id"/);
    expect(params).toEqual(['evt-1', 'budget-consumer']);
  });

  it('returns false for a duplicate (conflict, nothing returned)', async () => {
    manager.query.mockResolvedValue([]);

    await expect(
      service.markProcessed(
        manager as unknown as EntityManager,
        'evt-1',
        'budget-consumer',
      ),
    ).resolves.toBe(false);
  });
});
