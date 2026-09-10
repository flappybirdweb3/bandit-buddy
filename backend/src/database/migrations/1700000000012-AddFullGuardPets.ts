import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFullGuardPets1700000000012 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Replace old 2-tier guard dogs with proper 5-tier system
    await queryRunner.query(`DELETE FROM shop_items WHERE effect_type IN ('guard_pup', 'guard_hound')`);

    await queryRunner.query(`
      INSERT INTO shop_items (category, name, description, effect_type, effect_value, cost_gold, icon_key, sort_order)
      VALUES
        ('defense', 'Stray Dog',       'A stray mutt. Thieves still have 70% success.',       'dog_stray',    10,  500,   'pet_stray',    3),
        ('defense', 'Beagle',          'Hunting dog. Reduces steal chance to 55%.',            'dog_beagle',   25,  1500,  'pet_beagle',   4),
        ('defense', 'Husky',           'Fierce Husky. Only 40% steal chance!',                 'dog_husky',    40,  4000,  'pet_husky',    5),
        ('defense', 'German Shepherd', 'Elite guard dog. Only 20% steal success rate.',        'dog_shepherd', 60,  10000, 'pet_shepherd', 6),
        ('defense', 'Elephant',        'Legendary guardian. Blocks ALL theft completely! 🐘',  'elephant',     80,  25000, 'pet_elephant', 7)
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM shop_items WHERE effect_type IN ('dog_stray','dog_beagle','dog_husky','dog_shepherd','elephant')`);
    await queryRunner.query(`
      INSERT INTO shop_items (category, name, description, effect_type, effect_value, cost_gold, icon_key, sort_order)
      VALUES
        ('defense', 'Guard Pup',   '+15% steal defense. Only 1 allowed.', 'guard_pup',   15, 400,  'dog_pup',   3),
        ('defense', 'Guard Hound', '+30% steal defense. Max 1.',           'guard_hound', 30, 950,  'dog_hound', 4)
    `);
  }
}
