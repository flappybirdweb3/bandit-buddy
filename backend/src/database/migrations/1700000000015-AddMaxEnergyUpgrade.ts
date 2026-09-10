import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxEnergyUpgrade1700000000015 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // Add max_energy column (default 100, upgradeable via shop)
    await qr.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS max_energy INTEGER NOT NULL DEFAULT 100;
    `);

    // Add energy upgrade shop items
    await qr.query(`
      INSERT INTO shop_items (category, name, description, effect_type, effect_value, cost_gold, icon_key, sort_order)
      VALUES
        ('upgrades', 'Energy Tank I',    '+50 max energy permanently',  'max_energy', 50,  2000,  'energy_tank',   10),
        ('upgrades', 'Energy Tank II',   '+50 max energy permanently',  'max_energy', 50,  5000,  'energy_tank_2', 11),
        ('upgrades', 'Energy Tank III',  '+50 max energy permanently',  'max_energy', 50,  12000, 'energy_tank_3', 12)
      ON CONFLICT DO NOTHING;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE users DROP COLUMN IF EXISTS max_energy;`);
    await qr.query(`DELETE FROM shop_items WHERE effect_type = 'max_energy';`);
  }
}
