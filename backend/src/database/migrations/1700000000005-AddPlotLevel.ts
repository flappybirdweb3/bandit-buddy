import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlotLevel1700000000005 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE farm_plots ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE farm_plots DROP COLUMN IF EXISTS level`);
  }
}
