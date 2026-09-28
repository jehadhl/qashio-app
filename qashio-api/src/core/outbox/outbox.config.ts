import { registerAs } from '@nestjs/config';

// Read as configService.get('outbox.batchSize') etc.
export default registerAs('outbox', () => ({
  relayIntervalMs: parseInt(process.env.OUTBOX_RELAY_INTERVAL_MS || '1000', 10),
  batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10),
  // Permanent failures only; a Kafka outage never counts as an attempt
  maxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '10', 10),
  backoffBaseMs: parseInt(process.env.OUTBOX_BACKOFF_BASE_MS || '1000', 10),
  backoffMaxMs: parseInt(process.env.OUTBOX_BACKOFF_MAX_MS || '60000', 10),
  retentionDays: parseInt(process.env.OUTBOX_RETENTION_DAYS || '7', 10),
  stuckThresholdMin: parseInt(
    process.env.OUTBOX_STUCK_THRESHOLD_MIN || '5',
    10,
  ),
  consumerMaxRetries: parseInt(process.env.CONSUMER_MAX_RETRIES || '5', 10),
}));
