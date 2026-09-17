import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryExtensions1700000000028 implements MigrationInterface {
  name = 'AddInventoryExtensions1700000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user_items: widen item_type, add locked_quantity ──────────────────
    await queryRunner.query(`
      ALTER TABLE "user_items"
        ALTER COLUMN "item_type" TYPE VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "locked_quantity" INTEGER NOT NULL DEFAULT 0
    `);

    // ── marketplace_listings: add asset_type, item_type, quantity ─────────
    await queryRunner.query(`
      ALTER TABLE "marketplace_listings"
        ADD COLUMN IF NOT EXISTS "asset_type"  VARCHAR(20)   NOT NULL DEFAULT 'nft',
        ADD COLUMN IF NOT EXISTS "item_type"   VARCHAR(100)  NULL,
        ADD COLUMN IF NOT EXISTS "quantity"    DECIMAL(20,4) NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "price_per_unit" DECIMAL(20,8) NULL
    `);

    // Make nft_contract + token_id nullable (not required for user_items listings)
    await queryRunner.query(`
      ALTER TABLE "marketplace_listings"
        ALTER COLUMN "nft_contract" DROP NOT NULL,
        ALTER COLUMN "token_id"     DROP NOT NULL
    `);

    // Drop old unique index that required both nft_contract and token_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_marketplace_contract_token_active"
    `);

    // New index: one active listing per seller + item (user_items)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketplace_seller_item_active"
        ON "marketplace_listings"("seller_id", "item_type")
        WHERE "status" = 'active' AND "asset_type" = 'user_items'
    `);

    // Keep NFT uniqueness: one active listing per nft_contract + token_id
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketplace_nft_active"
        ON "marketplace_listings"("nft_contract", "token_id")
        WHERE "status" = 'active' AND "asset_type" = 'nft'
          AND "nft_contract" IS NOT NULL AND "token_id" IS NOT NULL
    `);

    // Index for filtering listings by item_type (Crops tab, Tools tab)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_item_type_status"
        ON "marketplace_listings"("item_type", "status")
        WHERE "asset_type" = 'user_items'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_marketplace_item_type_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_marketplace_nft_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_marketplace_seller_item_active"`);
    await queryRunner.query(`
      ALTER TABLE "marketplace_listings"
        DROP COLUMN IF EXISTS "price_per_unit",
        DROP COLUMN IF EXISTS "quantity",
        DROP COLUMN IF EXISTS "item_type",
        DROP COLUMN IF EXISTS "asset_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_items"
        DROP COLUMN IF EXISTS "locked_quantity",
        ALTER COLUMN "item_type" TYPE VARCHAR(50)
    `);
  }
}
