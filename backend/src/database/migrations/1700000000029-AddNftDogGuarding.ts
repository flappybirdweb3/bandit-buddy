import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNftDogGuarding1700000000029 implements MigrationInterface {
  name = 'AddNftDogGuarding1700000000029';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Separate "owned by wallet" (is_active) from "assigned to guard" (is_guarding)
    await queryRunner.query(`
      ALTER TABLE nft_guard_dogs
      ADD COLUMN IF NOT EXISTS is_guarding BOOLEAN NOT NULL DEFAULT true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE nft_guard_dogs DROP COLUMN IF EXISTS is_guarding`);
  }
}
