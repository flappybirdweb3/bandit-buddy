import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMoreQuests1700000000013 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Fix steal_gold description/target mismatch (description says 30G, target was 50)
    await queryRunner.query(`
      UPDATE quest_definitions
      SET description = 'Steal 50G total today'
      WHERE quest_type = 'steal_gold' AND target_value = 50
    `);

    // Add new quest types if not present — insert new definitions
    await queryRunner.query(`
      INSERT INTO quest_definitions (quest_type, title, description, target_value, reward_gold, reward_energy, icon_key)
      VALUES
        -- More harvest variety
        ('harvest_count', 'Quick Harvest',    'Harvest 3 crops today',                    3,    150, 15, 'harvest'),
        ('harvest_count', 'Golden Fields',    'Harvest 8 crops today',                    8,    350, 40, 'harvest'),
        ('harvest_gold',  'Coin Collector',   'Earn 200G from your harvests',             200,  120,  0, 'gold'),
        ('harvest_gold',  'Gold Rush',        'Earn 1000G from your harvests',           1000,  500,  0, 'gold'),

        -- More plant variety
        ('plant_count',   'Seed Sprayer',     'Plant 8 seeds today',                      8,    280, 30, 'plant'),
        ('plant_count',   'Full Farm',        'Plant 10 seeds today',                    10,    350, 40, 'plant'),

        -- More steal variety
        ('steal_count',   'Gold Digger',      'Successfully steal from 4 farms',          4,    200, 25, 'steal'),
        ('steal_gold',    'Treasure Hunter',  'Steal 150G total today',                  150,   300,  0, 'gold'),

        -- New: attack quests
        ('attack_count',  'Saboteur',         'Throw bugs or weeds at 1 neighbor farm',   1,     80, 20, 'attack'),
        ('attack_count',  'Chaos Farmer',     'Sabotage 3 neighbor crops today',          3,    180, 30, 'attack'),

        -- New: water quests
        ('water_count',   'Diligent Farmer',  'Water 2 of your crops today',              2,     90, 15, 'water'),
        ('water_count',   'Green Thumb',      'Water 4 crops today',                      4,    180, 25, 'water')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Restore old description
    await queryRunner.query(`
      UPDATE quest_definitions
      SET description = 'Steal 30G total today'
      WHERE quest_type = 'steal_gold' AND target_value = 50
    `);

    // Remove the new quest definitions (by title to be safe)
    await queryRunner.query(`
      DELETE FROM quest_definitions WHERE title IN (
        'Quick Harvest', 'Golden Fields', 'Coin Collector', 'Gold Rush',
        'Seed Sprayer', 'Full Farm', 'Gold Digger', 'Treasure Hunter',
        'Saboteur', 'Chaos Farmer', 'Diligent Farmer', 'Green Thumb'
      )
    `);
  }
}
