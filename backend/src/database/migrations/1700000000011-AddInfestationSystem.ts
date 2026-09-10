import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInfestationSystem1700000000011 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE farm_plots
        ADD COLUMN IF NOT EXISTS has_bugs  BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS has_weeds BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE farm_plots DROP COLUMN IF EXISTS has_bugs`);
    await queryRunner.query(`ALTER TABLE farm_plots DROP COLUMN IF EXISTS has_weeds`);
  }
}
