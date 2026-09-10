import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit Fix Migration — consolidates all schema additions from:
 * - Issue #36: Farm Maintenance System (farm_buildings table)
 * - Issue #37: Soil Fertility Decay (soil_fertility, yield_multiplier on farm_plots)
 * - Issue #38: Revenge & Viral Mechanic (is_anonymous on steal_logs, user_items table)
 * - Issue #48: Guild Tier & Taxation (guilds, guild_members tables)
 * - Issue #49: Premium Subscriptions (user_subscriptions table)
 * - Issue #13: Level & XP system (xp, level on users)
 * - Issue #18: Blockchain Indexer (processed_onchain_txs, sync_state tables)
 * - Issue #55: Guard Dog Feeding (last_fed_at on nft_guard_dogs)
 */
export class AddAuditFixSchema1700000000018 implements MigrationInterface {
  name = 'AddAuditFixSchema1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Issue #13: XP & Level on users ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "xp"    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1
    `);

    // ── Issue #37: Soil Fertility + Yield Multiplier on farm_plots ───────────
    await queryRunner.query(`
      ALTER TABLE "farm_plots"
        ADD COLUMN IF NOT EXISTS "soil_fertility"    INTEGER          NOT NULL DEFAULT 100,
        ADD COLUMN IF NOT EXISTS "yield_multiplier"  DECIMAL(3,1)     NOT NULL DEFAULT 1.0
    `);

    // ── Issue #38: Anonymous theft flag on steal_logs ────────────────────────
    await queryRunner.query(`
      ALTER TABLE "steal_logs"
        ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN NOT NULL DEFAULT true
    `);

    // ── Issue #55: Guard dog hunger tracking ─────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "nft_guard_dogs"
        ADD COLUMN IF NOT EXISTS "last_fed_at" TIMESTAMP DEFAULT NOW()
    `);

    // ── Issue #36: Farm Buildings (durability system) ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "farm_buildings" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
        "fence_durability" INTEGER NOT NULL DEFAULT 100,
        "barn_durability"  INTEGER NOT NULL DEFAULT 100,
        "last_repaired_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── Issue #38: User Items (Magnifying Glass, Master Key) ─────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_items" (
        "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"   UUID    NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "item_type" VARCHAR(50) NOT NULL,
        "quantity"  INTEGER NOT NULL DEFAULT 0,
        UNIQUE("user_id", "item_type")
      )
    `);

    // ── Issue #48: Guilds ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guilds" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"          VARCHAR(100) NOT NULL UNIQUE,
        "owner_id"      UUID NOT NULL REFERENCES "users"("id"),
        "tier"          VARCHAR(20) NOT NULL DEFAULT 'free',
        "staked_farm"   DECIMAL(20,2) NOT NULL DEFAULT 0,
        "tax_rate"      DECIMAL(4,2)  NOT NULL DEFAULT 0,
        "world_tree_hp" INTEGER NOT NULL DEFAULT 1000,
        "created_at"    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guild_members" (
        "user_id"   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "guild_id"  UUID NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
        "role"      VARCHAR(20) NOT NULL DEFAULT 'member',
        "joined_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("user_id", "guild_id")
      )
    `);

    // ── Issue #49: Premium Subscriptions ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "sub_type"   VARCHAR(50) NOT NULL,
        "expires_at" TIMESTAMP   NOT NULL,
        "created_at" TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_subs_user_type_expires"
        ON "user_subscriptions"("user_id", "sub_type", "expires_at")
    `);

    // ── Issue #18: Blockchain Indexer idempotency tables ─────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_onchain_txs" (
        "tx_hash"      VARCHAR(66) PRIMARY KEY,
        "event_type"   VARCHAR(50) NOT NULL,
        "processed_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_state" (
        "key"        VARCHAR(50) PRIMARY KEY,
        "value"      TEXT        NOT NULL,
        "updated_at" TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);

    // ── Performance indexes ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_farm_plots_user_harvestable"
        ON "farm_plots"("user_id", "harvestable_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_steal_logs_victim_created"
        ON "steal_logs"("victim_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_guild_members_guild"
        ON "guild_members"("guild_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_onchain_txs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guild_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guilds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "farm_buildings"`);
    await queryRunner.query(`ALTER TABLE "nft_guard_dogs" DROP COLUMN IF EXISTS "last_fed_at"`);
    await queryRunner.query(`ALTER TABLE "steal_logs" DROP COLUMN IF EXISTS "is_anonymous"`);
    await queryRunner.query(`ALTER TABLE "farm_plots" DROP COLUMN IF EXISTS "yield_multiplier"`);
    await queryRunner.query(`ALTER TABLE "farm_plots" DROP COLUMN IF EXISTS "soil_fertility"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "level"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "xp"`);
  }
}
