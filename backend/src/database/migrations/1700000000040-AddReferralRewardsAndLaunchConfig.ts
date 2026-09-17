import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralRewardsAndLaunchConfig1700000000040 implements MigrationInterface {
  name = 'AddReferralRewardsAndLaunchConfig1700000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create referral_rewards table to track magnifying glasses and master keys awarded
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_type VARCHAR(50) NOT NULL,
        referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        milestone_count INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id, reward_type);
    `);

    // 2. Ensure system_config table exists and seed Initial Seeding launch configuration
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES
        ('IS_LAUNCH_EVENT_ACTIVE', 'true', NOW()),
        ('NEW_USER_STARTING_GOLD', '500', NOW()),
        ('NEW_USER_STARTING_MAGNIFIER', '1', NOW()),
        ('REF_MAGNIFIER_REWARD_MULTIPLIER', '2', NOW()),
        ('GUILD_NEW_MEMBER_WATER_BOOST', '10', NOW()),
        ('FIRST_DEPOSIT_GIFT_ENABLED', 'true', NOW())
      ON CONFLICT (key) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS referral_rewards;`);
  }
}
