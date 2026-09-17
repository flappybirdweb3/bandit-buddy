import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoldTransactions1700000000034 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gold_transactions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "amount"      DECIMAL(20, 2) NOT NULL,
        "type"        VARCHAR(10)    NOT NULL,
        "category"    VARCHAR(50)    NOT NULL,
        "description" VARCHAR(255),
        "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gold_tx_created_type"
        ON "gold_transactions" ("created_at" DESC, "type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gold_tx_user"
        ON "gold_transactions" ("user_id")
    `);

    // Seed baseline 24h mint and burn so initial Alpha = 1.0 (balanced)
    await queryRunner.query(`
      INSERT INTO "gold_transactions" ("amount", "type", "category", "description", "created_at")
      VALUES 
        (10000.00, 'MINT', 'SYSTEM_INITIAL_BASE', 'Initial economic baseline mint', NOW()),
        (10000.00, 'BURN', 'SYSTEM_INITIAL_BASE', 'Initial economic baseline burn', NOW())
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gold_transactions"`);
  }
}
