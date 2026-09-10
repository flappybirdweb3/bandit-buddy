import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptions1700000000024 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id),
        type          VARCHAR(30) NOT NULL,   -- 'butler' | 'crop_insurance'
        expires_at    TIMESTAMP NOT NULL,
        created_at    TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, type, expires_at);

      -- Shop items for subscriptions
      INSERT INTO shop_items (id, category, name, description, effect_type, effect_value, cost_gold, icon_key)
      VALUES
        (gen_random_uuid(), 'subscription', 'Butler (7 days)',   'Auto-harvests ripe crops every 30 min', 'butler_7d',        7,  500, 'butler'),
        (gen_random_uuid(), 'subscription', 'Butler (30 days)',  'Auto-harvests ripe crops every 30 min', 'butler_30d',      30, 1800, 'butler'),
        (gen_random_uuid(), 'subscription', 'Crop Insurance',    'Covers up to 50% of steal losses for 7 days', 'crop_insurance_7d', 7, 300, 'insurance')
      ON CONFLICT DO NOTHING;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS subscriptions;`);
  }
}
