import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixNftMarketplaceIndex1700000000037 implements MigrationInterface {
  name = 'FixNftMarketplaceIndex1700000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop incorrect global unique index that prevented multiple listings of the same ERC-1155 breed (tokenId)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_marketplace_nft_active";
    `);

    // Non-unique index for fast lookup of NFT listings by contract and token
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_nft_contract_token"
        ON "marketplace_listings"("nft_contract", "token_id", "status")
        WHERE "asset_type" = 'nft';
    `);

    // Index for fast nonce lookup per seller
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_seller_nft_nonce"
        ON "marketplace_listings"("seller_id", "nonce");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_marketplace_seller_nft_nonce";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_marketplace_nft_contract_token";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketplace_nft_active"
        ON "marketplace_listings"("nft_contract", "token_id")
        WHERE "status" = 'active' AND "asset_type" = 'nft'
          AND "nft_contract" IS NOT NULL AND "token_id" IS NOT NULL;
    `);
  }
}
