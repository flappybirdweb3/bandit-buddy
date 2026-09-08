import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegram_id" BIGINT UNIQUE NOT NULL,
        "username" VARCHAR(255),
        "wallet_address" VARCHAR(42),
        "gold_balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
        "energy" INTEGER NOT NULL DEFAULT 100,
        "trust_score" INTEGER NOT NULL DEFAULT 50,
        "nonce" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "seed_configs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "cost_gold" DECIMAL(10,2) NOT NULL,
        "grow_time_sec" INTEGER NOT NULL,
        "base_yield" DECIMAL(10,2) NOT NULL,
        "icon_key" VARCHAR(100)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "farm_plots" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "plot_index" INTEGER NOT NULL,
        "seed_id" UUID REFERENCES "seed_configs"("id"),
        "planted_at" TIMESTAMP,
        "harvestable_at" TIMESTAMP,
        "total_stolen" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "last_stolen_at" TIMESTAMP,
        UNIQUE("user_id", "plot_index")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "steal_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "thief_id" UUID NOT NULL REFERENCES "users"("id"),
        "victim_id" UUID NOT NULL REFERENCES "users"("id"),
        "plot_id" UUID NOT NULL REFERENCES "farm_plots"("id"),
        "amount" DECIMAL(10,2) NOT NULL,
        "success" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "nft_guard_dogs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_id" INTEGER NOT NULL,
        "dog_type" VARCHAR(50) NOT NULL,
        "defense_power" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true
      )
    `);

    // Indexes for performance
    await queryRunner.query(`CREATE INDEX "idx_farm_plots_user_id" ON "farm_plots"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_farm_plots_harvestable_at" ON "farm_plots"("harvestable_at")`);
    await queryRunner.query(`CREATE INDEX "idx_steal_logs_thief_id" ON "steal_logs"("thief_id")`);
    await queryRunner.query(`CREATE INDEX "idx_steal_logs_victim_id" ON "steal_logs"("victim_id")`);
    await queryRunner.query(`CREATE INDEX "idx_nft_guard_dogs_owner_active" ON "nft_guard_dogs"("owner_id") WHERE "is_active" = true`);

    // Seed data
    await queryRunner.query(`
      INSERT INTO "seed_configs" ("name", "cost_gold", "grow_time_sec", "base_yield", "icon_key") VALUES
        ('Wheat',   10,  300,   15,  'wheat'),
        ('Carrot',  25,  900,   40,  'carrot'),
        ('Corn',    50,  3600,  100, 'corn'),
        ('Tomato',  100, 7200,  220, 'tomato'),
        ('Pumpkin', 200, 14400, 480, 'pumpkin')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "steal_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nft_guard_dogs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "farm_plots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seed_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
