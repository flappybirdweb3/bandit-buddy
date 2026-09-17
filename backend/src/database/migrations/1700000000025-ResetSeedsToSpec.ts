import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetSeedsToSpec1700000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear active plots that reference old seeds
    await queryRunner.query(`
      UPDATE farm_plots SET seed_id = NULL, planted_at = NULL, harvestable_at = NULL WHERE seed_id IS NOT NULL
    `);

    // Remove all old seeds
    await queryRunner.query(`DELETE FROM seed_configs`);

    // Insert 13 canonical seeds matching Items Specification Document
    await queryRunner.query(`
      INSERT INTO seed_configs (name, name_vi, category, grow_time_sec, grow_time_hours, cost_gold, base_yield, level_required, icon_key) VALUES
        ('Turnip',      'Turnip',             'root',    36000,  10.0,  120,   200,   0, 'turnip'),
        ('Carrot',      'Carrot',             'root',    46800,  13.0,  370,   600,   1, 'carrot'),
        ('Corn',        'Corn',               'grain',   54000,  15.0,  500,   850,   2, 'corn'),
        ('Potato',      'Potato',             'root',    64800,  18.0,  620,  1000,   3, 'potato'),
        ('Eggplant',    'Eggplant',           'fruit',   72000,  20.0,  750,  1200,   4, 'eggplant'),
        ('Tomato',      'Tomato',             'fruit',   79200,  22.0,  880,  1450,   5, 'tomato'),
        ('Pea',         'Pea',                'grain',   93600,  26.0, 1000,  1700,   6, 'pea'),
        ('Watermelon',  'Watermelon',         'fruit',  108000,  30.0, 1150,  2000,   7, 'watermelon'),
        ('Strawberry',  'Strawberry',         'fruit',  126000,  35.0, 1500,  2500,   9, 'strawberry'),
        ('Pumpkin',     'Pumpkin',            'fruit',  144000,  40.0, 2000,  3300,  11, 'pumpkin'),
        ('Grape',       'Grape',              'vine',   165600,  46.0, 2500,  4200,  13, 'grape'),
        ('Sunflower',   'Sunflower',          'flower', 187200,  52.0, 3200,  5500,  15, 'sunflower'),
        ('Rose',        'Rose',               'flower', 216000,  60.0, 4000,  7000,  18, 'rose')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM seed_configs`);
    // Restore original 5 seeds from InitSchema
    await queryRunner.query(`
      INSERT INTO seed_configs (name, cost_gold, grow_time_sec, base_yield, icon_key) VALUES
        ('Wheat',   10,    300,   15,  'wheat'),
        ('Carrot',  25,    900,   40,  'carrot'),
        ('Corn',    50,   3600,  100,  'corn'),
        ('Tomato', 100,   7200,  220,  'tomato'),
        ('Pumpkin',200,  14400,  480,  'pumpkin')
    `);
  }
}
