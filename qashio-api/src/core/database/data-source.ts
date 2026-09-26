import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import databaseConfig from '@/core/config/database.config';
import { ENV_FILE_PATHS } from '@/core/config/env-files';
import { buildTypeOrmOptions } from '@/core/database/typeorm.options';

config({ path: ENV_FILE_PATHS, quiet: true });

const AppDataSource = new DataSource(buildTypeOrmOptions(databaseConfig()));

export default AppDataSource;
