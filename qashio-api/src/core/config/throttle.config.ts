import { registerAs } from '@nestjs/config';

// Read as configService.get('throttle.ttl') etc.
// Shared rate limit applied to every route: `limit` requests per `ttl` ms.
export default registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '4', 10),
}));
