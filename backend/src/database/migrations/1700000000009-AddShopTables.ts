import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShopTables1700000000009 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // fertilizer charges on users
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS fertilizer_charges INT NOT NULL DEFAULT 0
    `);

    // source column on nft_guard_dogs to distinguish NFT vs shop dogs
    await queryRunner.query(`
      ALTER TABLE nft_guard_dogs
        ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'nft'
    `);

    // static shop items catalog
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        category      VARCHAR(30)   NOT NULL,
        name          VARCHAR(100)  NOT NULL,
        description   VARCHAR(255)  NOT NULL,
        effect_type   VARCHAR(50)   NOT NULL,
        effect_value  INT           NOT NULL,
        cost_gold     DECIMAL(10,2) NOT NULL,
        icon_key      VARCHAR(50)   NOT NULL,
        sort_order    INT           NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      INSERT INTO shop_items (category, name, description, effect_type, effect_value, cost_gold, icon_key, sort_order)
      VALUES
        ('energy',    'Energy Drink',     'Restore 40 energy instantly',           'energy',      40,  50,   'energy_sm',  1),
        ('energy',    'Full Recharge',    'Fully restore your energy to 100',      'energy',      100, 110,  'energy_lg',  2),
        ('defense',   'Guard Pup',        '+15% steal defense. Max 1.',            'guard_pup',   15,  400,  'dog_pup',    3),
        ('defense',   'Guard Hound',      '+30% steal defense. Max 1.',            'guard_hound', 30,  950,  'dog_hound',  4),
        ('boost',     'Fertilizer',       '+1 fertilizer charge. Next harvest gives 1.5× yield.',
                                                                                    'fertilizer',  1,   90,   'fertilizer', 5),
        ('boost',     'Turbo Fertilizer', '+3 fertilizer charges at a discount.',  'fertilizer',  3,   240,  'turbo_fert', 6)
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS shop_items');
    await queryRunner.query(`ALTER TABLE nft_guard_dogs DROP COLUMN IF EXISTS source`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS fertilizer_charges`);
  }
}
