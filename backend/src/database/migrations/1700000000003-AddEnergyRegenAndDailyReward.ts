import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnergyRegenAndDailyReward1700000000003 implements MigrationInterface {
  name = 'AddEnergyRegenAndDailyReward1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "last_energy_update" TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS "last_daily_claim"   TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "daily_streak"       INTEGER NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "last_energy_update",
        DROP COLUMN IF EXISTS "last_daily_claim",
        DROP COLUMN IF EXISTS "daily_streak"
    `);
  }
}
