import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDexTradeVolume1700000000033 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dex_trade_volume" (
        "wallet_address" VARCHAR(42) PRIMARY KEY,
        "volume_24h"     DECIMAL(30, 8) NOT NULL DEFAULT 0,
        "tier"           INTEGER        NOT NULL DEFAULT 1,
        "last_trade_at"  TIMESTAMP      NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMP      NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dex_trade_volume_tier"
        ON "dex_trade_volume" ("tier")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dex_trade_volume_last_trade"
        ON "dex_trade_volume" ("last_trade_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dex_trade_volume"`);
  }
}
