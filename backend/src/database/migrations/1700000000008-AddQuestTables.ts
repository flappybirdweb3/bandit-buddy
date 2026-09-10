import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuestTables1700000000008 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS quest_definitions (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        quest_type    VARCHAR(50)   NOT NULL,
        title         VARCHAR(100)  NOT NULL,
        description   VARCHAR(255)  NOT NULL,
        target_value  INT           NOT NULL,
        reward_gold   DECIMAL(10,2) NOT NULL,
        reward_energy INT           NOT NULL DEFAULT 0,
        icon_key      VARCHAR(50)   NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_daily_quests (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quest_def_id UUID         NOT NULL REFERENCES quest_definitions(id),
        quest_date   VARCHAR(10)  NOT NULL,
        progress     INT          NOT NULL DEFAULT 0,
        completed    BOOLEAN      NOT NULL DEFAULT false,
        claimed      BOOLEAN      NOT NULL DEFAULT false,
        UNIQUE (user_id, quest_def_id, quest_date)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_udq_user_date
        ON user_daily_quests (user_id, quest_date)
    `);

    /* ── Seed 8 quest definitions ── */
    await queryRunner.query(`
      INSERT INTO quest_definitions (quest_type, title, description, target_value, reward_gold, reward_energy, icon_key)
      VALUES
        ('harvest_count', 'Early Riser',    'Harvest 2 crops today',             2,   30, 0,  'wheat'),
        ('plant_count',   'Green Thumb',    'Plant 3 seeds today',               3,   20, 20, 'seedling'),
        ('steal_attempts','Prowler',        'Attempt 3 raids today',             3,   30, 0,  'ninja'),
        ('steal_count',   'Shadow Thief',   'Successfully steal from 2 farms',   2,   40, 0,  'thief'),
        ('steal_gold',    'Gold Rush',      'Steal 30G total today',             30,  50, 0,  'coin'),
        ('harvest_count', 'Busy Farmer',    'Harvest 5 crops today',             5,   60, 30, 'farm'),
        ('plant_count',   'Seed Spreader',  'Plant 5 seeds today',               5,   45, 25, 'seeds'),
        ('harvest_gold',  'Bumper Crop',    'Earn 100G from your harvests',      100, 35, 0,  'gold')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS user_daily_quests');
    await queryRunner.query('DROP TABLE IF EXISTS quest_definitions');
  }
}
