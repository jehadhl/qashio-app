import appConfig from '@/core/config/app.config';
import databaseConfig from '@/core/config/database.config';
import jwtConfig from '@/core/config/jwt.config';
import kafkaConfig from '@/core/config/kafka.config';
import throttleConfig from '@/core/config/throttle.config';

export default [
  appConfig,
  databaseConfig,
  jwtConfig,
  kafkaConfig,
  throttleConfig,
];
