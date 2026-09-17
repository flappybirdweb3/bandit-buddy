import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDogListingState1700000000038 implements MigrationInterface {
  name = 'AddDogListingState1700000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add listing_id foreign key column to nft_guard_dogs
    await queryRunner.query(`
      ALTER TABLE "nft_guard_dogs"
        ADD COLUMN IF NOT EXISTS "listing_id" UUID REFERENCES "marketplace_listings"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_nft_guard_dogs_listing_id"
        ON "nft_guard_dogs"("listing_id")
        WHERE "listing_id" IS NOT NULL;
    `);

    // 2. Cancel any active NFT listings where the seller has NO active dogs of that tokenId
    await queryRunner.query(`
      UPDATE marketplace_listings l
      SET status = 'cancelled'
      WHERE l.status = 'active' AND l.asset_type = 'nft'
        AND NOT EXISTS (
          SELECT 1 FROM nft_guard_dogs d
          WHERE d.owner_id = l.seller_id AND d.token_id = l.token_id AND d.is_active = true
        );
    `);

    // 3. If active NFT listings count > active dogs count for any seller & tokenId, cancel older surplus listings
    await queryRunner.query(`
      WITH ranked_listings AS (
        SELECT id, seller_id, token_id,
               ROW_NUMBER() OVER (PARTITION BY seller_id, token_id ORDER BY created_at DESC) as rn
        FROM marketplace_listings
        WHERE status = 'active' AND asset_type = 'nft'
      ),
      dog_counts AS (
        SELECT owner_id, token_id, COUNT(*) as dog_count
        FROM nft_guard_dogs
        WHERE is_active = true
        GROUP BY owner_id, token_id
      )
      UPDATE marketplace_listings l
      SET status = 'cancelled'
      FROM ranked_listings rl
      JOIN dog_counts dc ON dc.owner_id = rl.seller_id AND dc.token_id = rl.token_id
      WHERE l.id = rl.id AND rl.rn > dc.dog_count;
    `);

    // 4. Link remaining active NFT listings 1-to-1 with active dogs and set is_guarding = false on listed dogs
    await queryRunner.query(`
      WITH active_listings_ranked AS (
        SELECT id as listing_id, seller_id, token_id,
               ROW_NUMBER() OVER (PARTITION BY seller_id, token_id ORDER BY created_at ASC) as rn
        FROM marketplace_listings
        WHERE status = 'active' AND asset_type = 'nft'
      ),
      active_dogs_ranked AS (
        SELECT id as dog_id, owner_id, token_id,
               ROW_NUMBER() OVER (PARTITION BY owner_id, token_id ORDER BY id ASC) as rn
        FROM nft_guard_dogs
        WHERE is_active = true
      )
      UPDATE nft_guard_dogs d
      SET listing_id = al.listing_id,
          is_guarding = false
      FROM active_dogs_ranked ad
      JOIN active_listings_ranked al
        ON al.seller_id = ad.owner_id AND al.token_id = ad.token_id AND al.rn = ad.rn
      WHERE d.id = ad.dog_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_nft_guard_dogs_listing_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "nft_guard_dogs" DROP COLUMN IF EXISTS "listing_id";
    `);
  }
}
