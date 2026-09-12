import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.telegram_id is the game's only stable identity: every device, platform and
 * re-login must resolve to the SAME row through it. Without a UNIQUE constraint the login
 * flow could create a second account for one Telegram user (two parallel first-logins, or
 * any "read, then insert if absent" window), splitting gold, plots and the linked wallet
 * across two rows the player experiences as one account.
 *
 * NOTE ON EXISTING JUNK ROWS: the accounts created by the old client-side fallback each
 * carried a DIFFERENT, random telegram_id, so no constraint can detect or merge them —
 * this migration only prevents NEW duplicates. To find the semantic duplicates, run:
 *
 *   SELECT u.username, array_agg(u.id ORDER BY u.created_at) AS user_ids,
 *          array_agg(u.gold_balance ORDER BY u.created_at) AS gold,
 *          COUNT(*) AS rows
 *     FROM users u
 *    GROUP BY u.username
 *   HAVING COUNT(*) > 1;
 *
 * Merging them (moving gold, plots, items, the linked wallet) is a human decision: do it
 * deliberately, per account, before deleting anything.
 */
export class EnforceUniqueTelegramId1700000000033 implements MigrationInterface {
  name = 'EnforceUniqueTelegramId1700000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- 1. Real duplicates must be resolved by hand: which of the two rows holds the
        --    player's progress is not something this migration can guess.
        IF EXISTS (
          SELECT 1 FROM "users" GROUP BY "telegram_id" HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'users.telegram_id has duplicates. Inspect with: SELECT telegram_id, array_agg(id ORDER BY created_at), COUNT(*) FROM users GROUP BY telegram_id HAVING COUNT(*) > 1;';
        END IF;

        -- 2. Add the constraint only when nothing unique already covers the column, so a
        --    pre-existing UQ_/PK constraint (or index) is not duplicated.
        IF NOT EXISTS (
          SELECT 1
            FROM pg_index i
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = ANY (i.indkey)
           WHERE i.indrelid = 'users'::regclass
             AND i.indisunique
             AND i.indisvalid
             AND a.attname = 'telegram_id'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_telegram_id" UNIQUE ("telegram_id");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_telegram_id"`,
    );
  }
}
