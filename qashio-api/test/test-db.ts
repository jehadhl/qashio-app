// Test database lifecycle for e2e: create it if missing, apply the real migrations,
// and wipe all rows between runs. Never touches a database whose name doesn't end in _test.
import { readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { DataSource, MigrationInterface } from 'typeorm';
import databaseConfig from '@/core/config/database.config';
import { buildTypeOrmOptions } from '@/core/database/typeorm.options';

const MIGRATIONS_DIR = join(
  __dirname,
  '..',
  'src',
  'core',
  'database',
  'migrations',
);
const MIGRATION_FILE = /^\d+-.+\.ts$/;

type MigrationClass = new () => MigrationInterface;

function assertTestName(name: string): void {
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${name}": the database name must end with _test`,
    );
  }
}

const testDatabaseUrl = (): URL => {
  const url = new URL(process.env.DATABASE_URL!);
  assertTestName(url.pathname.slice(1));
  return url;
};

// Every <timestamp>-<name>.ts in the migrations folder, in timestamp order, so a new
// migration runs in e2e without touching this file. Each file must export one class.
function loadMigrations(): MigrationClass[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort()
    .map((file) => {
      const exported = Object.values(
        // Migrations are discovered at runtime, so they can't be static imports.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(join(MIGRATIONS_DIR, file)) as Record<string, unknown>,
      );
      const classes = exported.filter(
        (value): value is MigrationClass => typeof value === 'function',
      );
      if (classes.length !== 1) {
        throw new Error(
          `Migration ${file} must export exactly one class, found ${classes.length}`,
        );
      }
      return classes[0];
    });
}

async function createDatabaseIfMissing(url: URL): Promise<void> {
  const name = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}

// Creates the database if needed and brings its schema up to date with the migrations.
export async function prepareTestDatabase(): Promise<void> {
  await createDatabaseIfMissing(testDatabaseUrl());

  const dataSource = new DataSource({
    ...buildTypeOrmOptions(databaseConfig()),
    // Classes rather than TypeORM's file glob, so they load through ts-jest.
    migrations: loadMigrations(),
    logging: false,
  });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

// Empties every table except TypeORM's `migrations` bookkeeping, so each run starts clean.
// Checks the database the connection is actually on, not just the env var.
export async function truncateAll(dataSource: DataSource): Promise<void> {
  const [{ current_database: name }] = await dataSource.query<
    { current_database: string }[]
  >('SELECT current_database()');
  assertTestName(name);

  const rows = await dataSource.query<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
  );
  if (!rows.length) return;

  const tables = rows
    .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
    .join(', ');
  await dataSource.query(`TRUNCATE ${tables} CASCADE`);
}
