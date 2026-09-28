import {
  computeBackoffMs,
  isTransientKafkaError,
} from '@/core/outbox/outbox.backoff';

const kafkaError = (name: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(`${name} happened`), { name, ...extra });

describe('isTransientKafkaError', () => {
  it.each([
    'KafkaJSConnectionError',
    'KafkaJSConnectionClosedError',
    'KafkaJSRequestTimeoutError',
    'KafkaJSNumberOfRetriesExceeded',
    'KafkaJSBrokerNotFound',
    'KafkaJSNoBrokerAvailableError',
    'KafkaJSMetadataNotLoaded',
    'KafkaJSTopicMetadataNotLoaded',
    'KafkaJSLockTimeout',
  ])('%s is transient (Kafka is unavailable)', (name) => {
    expect(isTransientKafkaError(kafkaError(name))).toBe(true);
  });

  it('is transient when retries were exhausted on a connection error', () => {
    const error = kafkaError('KafkaJSNumberOfRetriesExceeded', {
      cause: kafkaError('KafkaJSConnectionError'),
    });
    expect(isTransientKafkaError(error)).toBe(true);
  });

  it.each([
    'MESSAGE_TOO_LARGE',
    'RECORD_LIST_TOO_LARGE',
    'UNKNOWN_TOPIC_OR_PARTITION',
    'INVALID_RECORD',
  ])('a %s protocol error is permanent', (type) => {
    expect(
      isTransientKafkaError(kafkaError('KafkaJSProtocolError', { type })),
    ).toBe(false);
  });

  it('is permanent when retries were exhausted on a permanent protocol error', () => {
    const error = kafkaError('KafkaJSNumberOfRetriesExceeded', {
      cause: kafkaError('KafkaJSProtocolError', {
        type: 'UNKNOWN_TOPIC_OR_PARTITION',
      }),
    });
    expect(isTransientKafkaError(error)).toBe(false);
  });

  it('treats serialization and unknown errors as permanent', () => {
    expect(
      isTransientKafkaError(new TypeError('Converting circular structure')),
    ).toBe(false);
    expect(isTransientKafkaError('boom')).toBe(false);
    expect(isTransientKafkaError(null)).toBe(false);
  });
});

describe('computeBackoffMs', () => {
  const noJitter = () => 0;

  it('starts at the base delay', () => {
    expect(computeBackoffMs(1, 1000, 60000, noJitter)).toBe(1000);
  });

  it('doubles with each attempt', () => {
    expect(computeBackoffMs(2, 1000, 60000, noJitter)).toBe(2000);
    expect(computeBackoffMs(3, 1000, 60000, noJitter)).toBe(4000);
    expect(computeBackoffMs(6, 1000, 60000, noJitter)).toBe(32000);
  });

  it('is capped at the max delay', () => {
    expect(computeBackoffMs(7, 1000, 60000, noJitter)).toBe(60000);
    expect(computeBackoffMs(50, 1000, 60000, noJitter)).toBe(60000);
  });

  it('adds up to 20% jitter', () => {
    expect(computeBackoffMs(1, 1000, 60000, () => 0.5)).toBe(1100);
    expect(computeBackoffMs(1, 1000, 60000, () => 0.999)).toBeLessThanOrEqual(
      1200,
    );
    expect(computeBackoffMs(50, 1000, 60000, () => 0.999)).toBeLessThanOrEqual(
      72000,
    );
  });
});
