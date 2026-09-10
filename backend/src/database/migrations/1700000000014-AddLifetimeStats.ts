import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLifetimeStats1700000000014 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS total_attacks INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_waters  INT NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS total_attacks,
        DROP COLUMN IF EXISTS total_waters
    `);
  }
}
