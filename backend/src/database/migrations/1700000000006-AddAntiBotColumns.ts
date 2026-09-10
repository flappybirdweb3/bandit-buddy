import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAntiBotColumns1700000000006 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS daily_steal_count       INT          NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_steal_date         VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS consecutive_steal_failures INT        NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS daily_steal_count,
        DROP COLUMN IF EXISTS last_steal_date,
        DROP COLUMN IF EXISTS consecutive_steal_failures
    `);
  }
}
