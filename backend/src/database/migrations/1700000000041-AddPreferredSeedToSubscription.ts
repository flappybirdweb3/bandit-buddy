import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreferredSeedToSubscription1700000000041 implements MigrationInterface {
  name = 'AddPreferredSeedToSubscription1700000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions 
      ADD COLUMN IF NOT EXISTS preferred_seed_id UUID REFERENCES seed_configs(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions 
      DROP COLUMN IF EXISTS preferred_seed_id;
    `);
  }
}
