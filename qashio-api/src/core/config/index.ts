import appConfig from '@/core/config/app.config';
import databaseConfig from '@/core/config/database.config';
import jwtConfig from '@/core/config/jwt.config';
import kafkaConfig from '@/core/config/kafka.config';
import throttleConfig from '@/core/config/throttle.config';
import outboxConfig from '@/core/outbox/outbox.config';

export default [
  appConfig,
  databaseConfig,
  jwtConfig,
  kafkaConfig,
  outboxConfig,
  throttleConfig,
];
