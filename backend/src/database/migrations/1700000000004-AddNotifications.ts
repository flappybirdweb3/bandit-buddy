import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1700000000004 implements MigrationInterface {
  name = 'AddNotifications1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "notifications_enabled" BOOLEAN NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "notifications_enabled"`);
  }
}
