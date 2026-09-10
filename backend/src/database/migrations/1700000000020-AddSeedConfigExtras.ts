import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeedConfigExtras1700000000020 implements MigrationInterface {
  name = 'AddSeedConfigExtras1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seed_configs"
        ADD COLUMN IF NOT EXISTS "category"       VARCHAR(20)    NOT NULL DEFAULT 'root',
        ADD COLUMN IF NOT EXISTS "grow_time_hours" DECIMAL(5,1)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "name_vi"        VARCHAR(100)   NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seed_configs"
        DROP COLUMN IF EXISTS "name_vi",
        DROP COLUMN IF EXISTS "grow_time_hours",
        DROP COLUMN IF EXISTS "category"
    `);
  }
}
