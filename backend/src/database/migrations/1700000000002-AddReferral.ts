import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferral1700000000002 implements MigrationInterface {
  name = 'AddReferral1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "referred_by" UUID REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_by"`);
  }
}
