import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two fixes to users.wallet_address, both required by MarketplaceService:
 *
 * 1. Lowercase existing values. Rows were written verbatim by updateWalletAddress(), and
 *    clients send EIP-55 checksummed addresses (viem). Every lookup does
 *    `wallet_address = lower(...)`, so checksummed rows never matched — off-chain item
 *    delivery silently failed and the event sweep retried forever.
 *
 * 2. Unique index (partial, NULLs excluded). Without it two Telegram accounts can link the
 *    same wallet, after which `findOne(User, { where: { walletAddress } })` returns an
 *    arbitrary row — items and NFT sync land on the wrong account.
 *
 * NOTE: `CREATE UNIQUE INDEX` is intentionally NOT `CONCURRENTLY` — TypeORM runs migrations
 * inside a transaction, where CONCURRENTLY is illegal. The table is small; the brief write
 * lock is acceptable. If it fails with duplicated values, diagnose with the query in the
 * runbook before deleting anything — a duplicate link is a human decision, not a cleanup.
 */
export class NormalizeWalletAddressCase1700000000032 implements MigrationInterface {
  name = 'NormalizeWalletAddressCase1700000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Canonicalise. `<> LOWER(...)` keeps this an index-friendly no-op for rows already
    //    lowercase, so re-running on a partially migrated database is cheap.
    await queryRunner.query(`
      UPDATE "users"
         SET "wallet_address" = LOWER("wallet_address")
       WHERE "wallet_address" IS NOT NULL
         AND "wallet_address" <> LOWER("wallet_address")
    `);

    // 2. One wallet per account. Partial so the many NULL rows (wallet not linked yet) do
    //    not collide with each other.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_wallet_address"
        ON "users" ("wallet_address")
        WHERE "wallet_address" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irreversible in the useful direction: the original mixed-case values are gone.
    // Dropping the index is all that can be undone.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_wallet_address"`);
  }
}
