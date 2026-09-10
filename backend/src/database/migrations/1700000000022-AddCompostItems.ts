import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompostItems1700000000022 implements MigrationInterface {
  name = 'AddCompostItems1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "shop_items" (category, name, description, effect_type, effect_value, cost_gold, icon_key, sort_order)
      VALUES
        ('soil', 'Basic Compost',   'Restores +20% soil fertility to your lowest-fertility plots',   'soil_restore_basic',   20, 30,  'compost_basic',   50),
        ('soil', 'Premium Compost', 'Restores +50% soil fertility to your lowest-fertility plots',   'soil_restore_premium', 50, 60,  'compost_premium', 51)
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "shop_items" WHERE effect_type IN ('soil_restore_basic', 'soil_restore_premium')
    `);
  }
}
