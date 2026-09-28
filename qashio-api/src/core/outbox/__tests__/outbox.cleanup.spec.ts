import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import {
  CLEANUP_BATCH_SIZE,
  OutboxCleanup,
} from '@/core/outbox/outbox.cleanup';

describe('OutboxCleanup', () => {
  const config = { retentionDays: 7 } as ConfigType<typeof outboxConfig>;
  const dataSource = { query: jest.fn() };
  const cleanup = new OutboxCleanup(
    dataSource as unknown as DataSource,
    config,
  );

  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  const calls = () => dataSource.query.mock.calls as [string, unknown[]][];
  const outboxCalls = () =>
    calls().filter(([sql]) => sql.includes('DELETE FROM "outbox_events"'));
  const processedCalls = () =>
    calls().filter(([sql]) => sql.includes('DELETE FROM "processed_events"'));

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockReset();
  });

  it('deletes only SENT outbox rows older than the retention', async () => {
    dataSource.query.mockResolvedValue([{ count: 0 }]);

    await cleanup.cleanup();

    const [[sql, params]] = outboxCalls();
    expect(sql).toMatch(/"status" = 'SENT'/);
    expect(sql).toMatch(/"sent_at" < now\(\) - make_interval\(days => \$1\)/);
    // PENDING and FAILED are never targeted
    expect(sql).not.toMatch(/PENDING|FAILED/);
    expect(params).toEqual([7, CLEANUP_BATCH_SIZE]);
  });

  it('deletes processed_events older than the retention', async () => {
    dataSource.query.mockResolvedValue([{ count: 0 }]);

    await cleanup.cleanup();

    const [[sql, params]] = processedCalls();
    expect(sql).toMatch(
      /"processed_at" < now\(\) - make_interval\(days => \$1\)/,
    );
    expect(params).toEqual([7, CLEANUP_BATCH_SIZE]);
  });

  it('keeps deleting in batches until a batch comes back short, then logs counts', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ count: CLEANUP_BATCH_SIZE }])
      .mockResolvedValueOnce([{ count: CLEANUP_BATCH_SIZE }])
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 3 }]);

    await cleanup.cleanup();

    expect(outboxCalls()).toHaveLength(3);
    expect(processedCalls()).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(
      '✓ cleanup: removed 2005 sent, 3 processed',
    );
  });

  it('logs a query error instead of throwing', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));

    await expect(cleanup.cleanup()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
