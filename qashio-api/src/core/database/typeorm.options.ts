import { join } from 'path';
import type { ConfigType } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import databaseConfig from '@/core/config/database.config';

export const buildTypeOrmOptions = (
  db: ConfigType<typeof databaseConfig>,
): DataSourceOptions => ({
  type: 'postgres',
  url: db.url,
  ssl: db.ssl,
  logging: db.logging,

  entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',

  synchronize: db.synchronize,
  migrationsRun: false,

  extra: db.pool,
});
