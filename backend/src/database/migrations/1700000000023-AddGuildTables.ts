import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuildTables1700000000023 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS guilds (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) UNIQUE NOT NULL,
        owner_id      UUID NOT NULL REFERENCES users(id),
        tier          VARCHAR(20) NOT NULL DEFAULT 'free',
        staked_farm   DECIMAL(20,2) NOT NULL DEFAULT 0,
        tax_rate      DECIMAL(4,2) NOT NULL DEFAULT 0,
        world_tree_hp INTEGER NOT NULL DEFAULT 1000,
        created_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS guild_members (
        user_id   UUID NOT NULL REFERENCES users(id),
        guild_id  UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        role      VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
      CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DROP TABLE IF EXISTS guild_members;
      DROP TABLE IF EXISTS guilds;
    `);
  }
}
