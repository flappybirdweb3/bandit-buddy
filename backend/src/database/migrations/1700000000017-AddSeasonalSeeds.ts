import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonalSeeds1700000000017 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // Add category column to seed_configs (regular vs seasonal)
    await qr.query(`
      ALTER TABLE seed_configs
      ADD COLUMN IF NOT EXISTS is_seasonal BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS seasonal_tag VARCHAR(30) NULL;
    `);

    // Seasonal seeds: limited availability, higher yield ratio
    await qr.query(`
      INSERT INTO seed_configs (name, cost_gold, grow_time_sec, base_yield, icon_key, level_required, is_seasonal, seasonal_tag)
      VALUES
        ('Jack-o-Lantern', 3000, 28800, 6000, 'jackolantern', 8,  true, 'halloween'),
        ('Candy Corn',     1500, 14400, 2800, 'candycorn',    5,  true, 'halloween'),
        ('Christmas Tree', 5000, 57600, 10000, 'christmastree', 12, true, 'christmas'),
        ('Snowdrop',       800,  7200,  1400, 'snowdrop',     3,  true, 'christmas'),
        ('Lucky Bamboo',   2000, 21600, 4000, 'luckybamboo',  6,  true, 'lunar')
      ON CONFLICT DO NOTHING;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DELETE FROM seed_configs WHERE is_seasonal = true;`);
    await qr.query(`ALTER TABLE seed_configs DROP COLUMN IF EXISTS is_seasonal, DROP COLUMN IF EXISTS seasonal_tag;`);
  }
}
