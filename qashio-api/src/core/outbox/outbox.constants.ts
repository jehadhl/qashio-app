// Consumer names recorded in processed_events; one row per (event, consumer)
export const OUTBOX_CONSUMERS = {
  BUDGET: 'budget-consumer',
} as const;

// Kafka header carrying the outbox row id, so consumers can dedupe without parsing
export const EVENT_ID_HEADER = 'event-id';
