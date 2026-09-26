export const KAFKA_CLIENT = Symbol('KAFKA_CLIENT');

export const KAFKA_TOPICS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
} as const;

export const KAFKA_TOPIC_PARTITIONS = 2;
