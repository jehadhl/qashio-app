import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactions1790406939997 implements MigrationInterface {
  name = 'CreateTransactions1790406939997';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense')`);
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "amount" numeric(12, 2) NOT NULL,
        "type" "public"."transaction_type" NOT NULL,
        "status" "public"."transaction_status" NOT NULL DEFAULT 'completed',
        "date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reference" character varying(50) NOT NULL,
        "counterparty" character varying(100) NOT NULL,
        "narration" text NOT NULL,
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "chk_transactions_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_category" ON "transactions" ("user_id", "category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_user_date" ON "transactions" ("user_id", "date")`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
    await queryRunner.query(`DROP INDEX "public"."idx_transactions_user_date"`);
    await queryRunner.query(`DROP INDEX "public"."idx_transactions_user_category"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transaction_status"`);
    await queryRunner.query(`DROP TYPE "public"."transaction_type"`);
  }
}
