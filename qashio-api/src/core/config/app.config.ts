import { registerAs } from '@nestjs/config';

// Read as configService.get('app.port') etc.
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  bodyLimit: process.env.BODY_LIMIT || '1mb',
}));
