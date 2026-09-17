import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogIndexToProcessedOnchainTxs1700000000039 implements MigrationInterface {
  name = 'AddLogIndexToProcessedOnchainTxs1700000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        ADD COLUMN IF NOT EXISTS "log_index" INTEGER NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        DROP CONSTRAINT IF EXISTS "PK_processed_onchain_txs";
    `);

    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        DROP CONSTRAINT IF EXISTS "processed_onchain_txs_pkey";
    `);

    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        ADD CONSTRAINT "PK_processed_onchain_txs" PRIMARY KEY ("tx_hash", "log_index");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        DROP CONSTRAINT IF EXISTS "PK_processed_onchain_txs";
    `);

    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        ADD CONSTRAINT "PK_processed_onchain_txs" PRIMARY KEY ("tx_hash");
    `);

    await queryRunner.query(`
      ALTER TABLE "processed_onchain_txs"
        DROP COLUMN IF EXISTS "log_index";
    `);
  }
}
