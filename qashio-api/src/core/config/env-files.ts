// .env files in load order: environment-specific values win over shared ones
// (neither overrides variables already set in the real environment).
// Used by ConfigModule (the app) and the TypeORM CLI data source.
export const ENV_FILE_PATHS = [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'];
