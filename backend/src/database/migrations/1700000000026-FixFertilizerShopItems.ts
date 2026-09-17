import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixFertilizerShopItems1700000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove old incorrect fertilizer items (wrong effect_type, wrong prices, wrong description)
    await queryRunner.query(`DELETE FROM shop_items WHERE effect_type = 'fertilizer'`);

    // Insert 3 correct fertilizer items matching Items Specification Document
    await queryRunner.query(`
      INSERT INTO shop_items (name, description, category, effect_type, effect_value, cost_gold, icon_key, sort_order) VALUES
        ('Normal Fertilizer',   'Reduces grow time by 1 hour. (−1h)',    'boost', 'fertilizer_normal',   1, 50,  'fertilizer_normal',   10),
        ('Super Fertilizer',    'Reduces grow time by 2.5 hours. (−2.5h)', 'boost', 'fertilizer_super',    1, 150, 'fertilizer_super',    11),
        ('Advanced Fertilizer', 'Reduces grow time by 5 hours. (−5h)',   'boost', 'fertilizer_advanced', 1, 300, 'fertilizer_advanced', 12)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM shop_items WHERE effect_type IN ('fertilizer_normal', 'fertilizer_super', 'fertilizer_advanced')`);
    await queryRunner.query(`
      INSERT INTO shop_items (name, description, category, effect_type, effect_value, cost_gold, icon_key, sort_order) VALUES
        ('Fertilizer',       '+1 fertilizer charge. Next harvest gives 1.5x yield.', 'boost', 'fertilizer', 1,  90, 'fertilizer', 10),
        ('Turbo Fertilizer', '+3 fertilizer charges at a discount.',                 'boost', 'fertilizer', 3, 240, 'fertilizer', 11)
    `);
  }
}
