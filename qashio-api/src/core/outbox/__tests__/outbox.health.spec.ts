import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import outboxConfig from '@/core/outbox/outbox.config';
import { OutboxHealth } from '@/core/outbox/outbox.health';

describe('OutboxHealth', () => {
  const config = { stuckThresholdMin: 5 } as ConfigType<typeof outboxConfig>;
  const dataSource = { query: jest.fn() };
  const health = new OutboxHealth(dataSource as unknown as DataSource, config);

  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'debug').mockImplementation();

  const stats = (
    failed: number,
    pending: number,
    oldestAgeMin: number | null,
  ) => {
    dataSource.query
      .mockResolvedValueOnce([{ failed }])
      .mockResolvedValueOnce([{ pending, oldest_age_min: oldestAgeMin }]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockReset();
  });

  afterEach(() => {
    // Read-only: every statement it ran is a SELECT
    for (const [sql] of dataSource.query.mock.calls as [string][]) {
      expect(sql.trim()).toMatch(/^SELECT/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
    }
  });

  it('warns when there are FAILED events', async () => {
    stats(3, 0, null);

    await health.check();

    expect(warn).toHaveBeenCalledWith(
      '⚠ 3 outbox event(s) in FAILED state need attention',
    );
  });

  it('warns when the oldest PENDING event is older than the threshold', async () => {
    stats(0, 12, 7.6);

    await health.check();

    expect(warn).toHaveBeenCalledWith(
      '⚠ oldest PENDING event is 7 min old — is Kafka down? (12 PENDING)',
    );
  });

  it('stays quiet when everything is healthy', async () => {
    stats(0, 2, 0.1);

    await health.check();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('stays quiet when there is nothing pending', async () => {
    stats(0, 0, null);

    await health.check();

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a query error instead of throwing', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));

    await expect(health.check()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
