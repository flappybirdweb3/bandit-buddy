import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationInbox1700000000010 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       VARCHAR(50) NOT NULL,
        title      VARCHAR(100) NOT NULL,
        body       VARCHAR(255) NOT NULL,
        is_read    BOOLEAN     NOT NULL DEFAULT false,
        created_at TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_unotif_user_unread
        ON user_notifications (user_id, is_read, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS user_notifications');
  }
}
