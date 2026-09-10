import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationActor1700000000016 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE user_notifications
      ADD COLUMN IF NOT EXISTS actor_user_id UUID NULL,
      ADD COLUMN IF NOT EXISTS actor_username VARCHAR(255) NULL;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE user_notifications
      DROP COLUMN IF EXISTS actor_user_id,
      DROP COLUMN IF EXISTS actor_username;
    `);
  }
}
