import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeduplicateShopItemsAndAddConstraint1700000000035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove duplicate items keeping only one entry per item name
    await queryRunner.query(`
      DELETE FROM shop_items
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id
        FROM shop_items
        ORDER BY name, id
      );
    `);

    // 2. Add unique constraint on (category, name) to prevent future duplicate inserts
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_shop_items_category_name'
        ) THEN
          ALTER TABLE shop_items ADD CONSTRAINT uq_shop_items_category_name UNIQUE (category, name);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS uq_shop_items_category_name;
    `);
  }
}
