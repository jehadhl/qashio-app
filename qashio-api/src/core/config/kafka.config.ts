import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: (process.env.KAFKA_BROKER ?? 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID ?? 'qashio-api',
  groupId: process.env.KAFKA_GROUP_ID ?? 'qashio-api',
}));
