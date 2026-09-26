import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  return {
    url,
    synchronize: false,

    logging: process.env.NODE_ENV === 'development',

    ssl: process.env.NODE_ENV === 'production',

    pool: {
      max: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
});
