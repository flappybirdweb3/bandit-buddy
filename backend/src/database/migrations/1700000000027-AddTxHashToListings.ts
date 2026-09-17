import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTxHashToListings1700000000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_listings
      ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(66) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS tx_hash
    `);
  }
}
