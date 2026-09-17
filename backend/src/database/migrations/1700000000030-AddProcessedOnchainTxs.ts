import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessedOnchainTxs1700000000030 implements MigrationInterface {
  name = 'AddProcessedOnchainTxs1700000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_onchain_txs" (
        "tx_hash"      VARCHAR(66)  NOT NULL,
        "event_type"   VARCHAR(50)  NOT NULL,
        "processed_at" TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_onchain_txs" PRIMARY KEY ("tx_hash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_processed_onchain_txs_event_type"
        ON "processed_onchain_txs" ("event_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "processed_onchain_txs"`);
  }
}
