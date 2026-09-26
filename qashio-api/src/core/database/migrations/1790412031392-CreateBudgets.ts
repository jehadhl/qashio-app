import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBudgets1790412031392 implements MigrationInterface {
  name = 'CreateBudgets1790412031392';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."budget_period" AS ENUM('weekly', 'monthly', 'yearly')`);
    // The unique (user_id, category_id, period) also serves lookups by user_id.
    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "amount" numeric(12, 2) NOT NULL,
        "period" "public"."budget_period" NOT NULL,
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "uq_budgets_user_category_period" UNIQUE ("user_id", "category_id", "period"),
        CONSTRAINT "chk_budgets_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "budgets"
      ADD CONSTRAINT "fk_budgets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "budgets"
      ADD CONSTRAINT "fk_budgets_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "fk_budgets_category_id"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "fk_budgets_user_id"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TYPE "public"."budget_period"`);
  }
}
