import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingEntityColumns1700000000019 implements MigrationInterface {
  name = 'AddMissingEntityColumns1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users: split fertilizer_charges → 3-tier fertilizer system
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "normal_fert_charges"   INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "super_fert_charges"    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "advanced_fert_charges" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_harvests"        INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_plants"          INTEGER NOT NULL DEFAULT 0
    `);

    // farm_plots: fertilized flag + last_watered_at
    await queryRunner.query(`
      ALTER TABLE "farm_plots"
        ADD COLUMN IF NOT EXISTS "fertilized"      BOOLEAN   NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "last_watered_at" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "farm_plots"
        DROP COLUMN IF EXISTS "last_watered_at",
        DROP COLUMN IF EXISTS "fertilized"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "total_plants",
        DROP COLUMN IF EXISTS "total_harvests",
        DROP COLUMN IF EXISTS "advanced_fert_charges",
        DROP COLUMN IF EXISTS "super_fert_charges",
        DROP COLUMN IF EXISTS "normal_fert_charges"
    `);
  }
}
