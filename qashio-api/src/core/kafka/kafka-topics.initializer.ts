import { Logger } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';
import {
  KAFKA_TOPIC_PARTITIONS,
  KAFKA_TOPICS,
} from '@/core/kafka/kafka.constants';

const logger = new Logger('KafkaTopics');

export async function ensureKafkaTopics(
  brokers: string[],
  clientId: string,
): Promise<void> {
  const admin = new Kafka({
    clientId: `${clientId}-admin`,
    brokers,
    logLevel: logLevel.WARN,
  }).admin();

  const wanted = Object.values(KAFKA_TOPICS);

  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = wanted.filter((topic) => !existing.has(topic));

    if (missing.length) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({
          topic,
          numPartitions: KAFKA_TOPIC_PARTITIONS,
          replicationFactor: 1,
        })),
      });
      logger.log(
        `Created ${missing.join(', ')} with ${KAFKA_TOPIC_PARTITIONS} partitions`,
      );
    }

    const { topics } = await admin.fetchTopicMetadata({ topics: wanted });
    const tooSmall = topics.filter(
      (t) => t.partitions.length < KAFKA_TOPIC_PARTITIONS,
    );
    if (tooSmall.length) {
      await admin.createPartitions({
        topicPartitions: tooSmall.map((t) => ({
          topic: t.name,
          count: KAFKA_TOPIC_PARTITIONS,
        })),
      });
      logger.log(
        `Grew ${tooSmall.map((t) => `${t.name} (${t.partitions.length})`).join(', ')} to ${KAFKA_TOPIC_PARTITIONS} partitions`,
      );
    }

    for (const t of topics) {
      logger.log(
        `${t.name}: ${Math.max(t.partitions.length, KAFKA_TOPIC_PARTITIONS)} partitions`,
      );
    }
  } finally {
    await admin.disconnect();
  }
}
