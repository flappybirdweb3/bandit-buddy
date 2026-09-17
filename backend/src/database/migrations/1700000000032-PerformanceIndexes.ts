import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes1700000000032 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_farm_plots_user_harvestable"
        ON "farm_plots" ("user_id", "harvestable_at")
        WHERE "seed_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_steal_logs_victim_created"
        ON "steal_logs" ("victim_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nft_guard_dogs_owner_active"
        ON "nft_guard_dogs" ("owner_id", "is_active")
        WHERE "is_active" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketplace_listings_type_deadline"
        ON "marketplace_listings" ("asset_type", "deadline")
        WHERE "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_items_user_type"
        ON "user_items" ("user_id", "item_type")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_farm_plots_user_harvestable"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_steal_logs_victim_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_nft_guard_dogs_owner_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marketplace_listings_type_deadline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_items_user_type"`);
  }
}
