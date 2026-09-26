import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1790373700339 implements MigrationInterface {
  name = 'CreateUsers1790373700339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('admin', 'user')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "first_name" character varying(50) NOT NULL,
        "last_name" character varying(50) NOT NULL,
        "refresh_token_hash" character varying(64),
        "role" "public"."user_role" NOT NULL DEFAULT 'user',
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
