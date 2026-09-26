import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories1790373701339 implements MigrationInterface {
  name = 'CreateCategories1790373701339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(50) NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "uq_categories_user_name" UNIQUE ("user_id", "name"),
        CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "fk_categories_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "fk_categories_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
