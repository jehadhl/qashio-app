// Kafka itself is unreachable: the message is fine, so retry forever without counting attempts
const TRANSIENT_ERROR_NAMES = new Set([
  'KafkaJSConnectionError',
  'KafkaJSConnectionClosedError',
  'KafkaJSRequestTimeoutError',
  'KafkaJSNumberOfRetriesExceeded',
  'KafkaJSBrokerNotFound',
  'KafkaJSNoBrokerAvailableError',
  'KafkaJSMetadataNotLoaded',
  'KafkaJSTopicMetadataNotLoaded',
  'KafkaJSLockTimeout',
]);

// Broker rejected this specific message; retrying the same bytes won't help forever
const PERMANENT_PROTOCOL_TYPES = new Set([
  'MESSAGE_TOO_LARGE',
  'RECORD_LIST_TOO_LARGE',
  'UNKNOWN_TOPIC_OR_PARTITION',
  'INVALID_RECORD',
  'CORRUPT_MESSAGE',
  'INVALID_TOPIC_EXCEPTION',
  'TOPIC_AUTHORIZATION_FAILED',
]);

const MAX_CAUSE_DEPTH = 5;

interface ErrorLike {
  name?: unknown;
  type?: unknown;
  cause?: unknown;
}

const asErrorLike = (value: unknown): ErrorLike | null =>
  typeof value === 'object' && value !== null ? value : null;

// kafkajs wraps the real failure in KafkaJSNumberOfRetriesExceeded (via `cause`), so a
// retried "unknown topic" must still count as permanent: any permanent cause wins.
export function isTransientKafkaError(error: unknown): boolean {
  let transient = false;
  let current = asErrorLike(error);

  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (
      typeof current.type === 'string' &&
      PERMANENT_PROTOCOL_TYPES.has(current.type)
    ) {
      return false;
    }
    if (
      typeof current.name === 'string' &&
      TRANSIENT_ERROR_NAMES.has(current.name)
    ) {
      transient = true;
    }
    current = asErrorLike(current.cause);
  }
  return transient;
}

// Delay before retry `attempts` (1-based): base * 2^(attempts-1), capped at max.
// `random` is injectable so tests are deterministic; jitter adds 0–20% on top.
export function computeBackoffMs(
  attempts: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  const exponential = baseMs * 2 ** Math.max(attempts - 1, 0);
  const delay = Math.min(exponential, maxMs);
  return Math.round(delay * (1 + random() * 0.2));
}
