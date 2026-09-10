import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketplace1700000000021 implements MigrationInterface {
  name = 'AddMarketplace1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_listings" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "seller_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "nft_contract" VARCHAR(42) NOT NULL,
        "token_id"     INTEGER NOT NULL,
        "price_farm"   DECIMAL(20,4) NOT NULL,
        "deadline"     TIMESTAMP NOT NULL,
        "nonce"        INTEGER NOT NULL DEFAULT 0,
        "eip712_sig"   VARCHAR(132) NOT NULL,
        "status"       VARCHAR(20) NOT NULL DEFAULT 'active',
        "buyer_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "filled_at"    TIMESTAMP NULL,
        "created_at"   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_status_deadline"
        ON "marketplace_listings"("status", "deadline")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_seller"
        ON "marketplace_listings"("seller_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketplace_contract_token_active"
        ON "marketplace_listings"("nft_contract", "token_id")
        WHERE "status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_listings"`);
  }
}
