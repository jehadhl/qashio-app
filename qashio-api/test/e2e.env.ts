// Runs before the e2e spec (and before AppModule is imported), so ConfigModule sees these.
// Real env vars win over .env files, so the app connects to the *test* database.
import { config } from 'dotenv';

process.env.NODE_ENV = 'test';
config({ path: ['.env.test', '.env'], quiet: true });

// E2E_DATABASE_URL, or the dev DATABASE_URL with "_test" appended to the database name.
const devUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/qashio_points';
const testUrl = new URL(process.env.E2E_DATABASE_URL ?? devUrl);
if (!process.env.E2E_DATABASE_URL) {
  testUrl.pathname = `${testUrl.pathname.replace(/_test$/, '')}_test`;
}
process.env.DATABASE_URL = testUrl.toString();

process.env.JWT_SECRET ??= 'e2e-test-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing in tests only

// Safety net: the Kafka client is faked in e2e, but if anything ever did connect,
// it would use its own client id and consumer group, never the dev app's.
process.env.KAFKA_CLIENT_ID = 'qashio-api-e2e';
process.env.KAFKA_GROUP_ID = 'qashio-api-e2e';
