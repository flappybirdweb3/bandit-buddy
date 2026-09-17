import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuildWorldTreeAndSocialFi1700000000036 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // 1. Add World Tree & Social-Fi columns to guilds table
    await qr.query(`
      ALTER TABLE guilds
      ADD COLUMN IF NOT EXISTS telegram_group_id VARCHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS tree_level INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS tree_progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'growing',
      ADD COLUMN IF NOT EXISTS ripe_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS shield_until TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS reward_pool_farm DECIMAL(20,2) NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS reward_pool_gold DECIMAL(20,2) NOT NULL DEFAULT 2000,
      ADD COLUMN IF NOT EXISTS last_attacked_at TIMESTAMP NULL;

      -- Sync existing elite guilds to is_premium = true
      UPDATE guilds SET is_premium = true WHERE tier = 'elite';

      CREATE INDEX IF NOT EXISTS idx_guilds_telegram_group_id ON guilds(telegram_group_id);
    `);

    // 2. Create tree_contributions table for Proof of Contribution
    await qr.query(`
      CREATE TABLE IF NOT EXISTS tree_contributions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id          UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        water_count       INTEGER NOT NULL DEFAULT 0,
        invited_count     INTEGER NOT NULL DEFAULT 0,
        calculated_points INTEGER NOT NULL DEFAULT 0,
        last_watered_at   TIMESTAMP NULL,
        claimed           BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMP DEFAULT NOW(),
        updated_at        TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_guild_user_tree_contribution UNIQUE (guild_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tree_contributions_guild ON tree_contributions(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tree_contributions_user ON tree_contributions(user_id);
      CREATE INDEX IF NOT EXISTS idx_tree_contributions_points ON tree_contributions(guild_id, calculated_points DESC);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DROP TABLE IF EXISTS tree_contributions;

      ALTER TABLE guilds
      DROP COLUMN IF EXISTS telegram_group_id,
      DROP COLUMN IF EXISTS is_premium,
      DROP COLUMN IF EXISTS tree_level,
      DROP COLUMN IF EXISTS tree_progress_percent,
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS ripe_at,
      DROP COLUMN IF EXISTS shield_until,
      DROP COLUMN IF EXISTS reward_pool_farm,
      DROP COLUMN IF EXISTS reward_pool_gold,
      DROP COLUMN IF EXISTS last_attacked_at;
    `);
  }
}
