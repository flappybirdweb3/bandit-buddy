import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemConfig1700000000031 implements MigrationInterface {
  name = 'AddSystemConfig1700000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_config" (
        "key"        VARCHAR(100) NOT NULL,
        "value"      VARCHAR(255) NOT NULL,
        "updated_at" TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_config" PRIMARY KEY ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_config"`);
  }
}
