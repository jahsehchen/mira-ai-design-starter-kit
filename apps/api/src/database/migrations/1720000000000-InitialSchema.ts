import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 初始 schema（PostgreSQL 目标）。
 * 生产/部署用 migration 建表；开发 SQLite 用 DB_SYNC=true（实体自动建表）。
 * 列名 snake_case，与实体 @Column({ name }) 保持一致。
 */
export class InitialSchema1720000000000 implements MigrationInterface {
  name = 'InitialSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "nickname" varchar(64) NOT NULL DEFAULT '',
        "avatar_url" varchar(512),
        "plan" varchar(16) NOT NULL DEFAULT 'free',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "works" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "owner_id" varchar(36) NOT NULL,
        "title" varchar(128) NOT NULL,
        "description" text,
        "thumbnail_url" varchar(512),
        "canvas_json" text,
        "width" int,
        "height" int,
        "format_meta" text,
        "source_generation_id" varchar(36),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_works_owner_id" ON "works" ("owner_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "owner_id" varchar(36) NOT NULL,
        "prompt" text NOT NULL,
        "style_preset" varchar(32),
        "options" text,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "step" int NOT NULL DEFAULT 0,
        "steps" text,
        "provider" varchar(32) NOT NULL DEFAULT 'mock',
        "result" text,
        "error_code" varchar(64),
        "error_message" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "finished_at" timestamp
      );
      CREATE INDEX IF NOT EXISTS "IDX_generations_owner_id" ON "generations" ("owner_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(64) NOT NULL,
        "category" varchar(16) NOT NULL,
        "description" varchar(255),
        "thumbnail_url" varchar(512),
        "gradient_from" varchar(16) NOT NULL,
        "gradient_to" varchar(16) NOT NULL,
        "display_text" varchar(64) NOT NULL,
        "canvas_json" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "owner_id" varchar(36) NOT NULL,
        "work_id" varchar(36) NOT NULL,
        "format" varchar(8) NOT NULL,
        "sizes" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "progress" int NOT NULL DEFAULT 0,
        "stage_text" varchar(64) NOT NULL DEFAULT '等待处理',
        "files" text,
        "error_code" varchar(64),
        "error_message" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "finished_at" timestamp
      );
      CREATE INDEX IF NOT EXISTS "IDX_export_jobs_owner_id" ON "export_jobs" ("owner_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "key" varchar(16) NOT NULL UNIQUE,
        "name" varchar(32) NOT NULL,
        "price_monthly_cents" int NOT NULL,
        "price_yearly_cents" int NOT NULL,
        "quota_per_month" int NOT NULL,
        "features" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" varchar(36) NOT NULL UNIQUE,
        "plan_key" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "billing_cycle" varchar(16) NOT NULL DEFAULT 'monthly',
        "started_at" timestamp NOT NULL DEFAULT now(),
        "expires_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shares" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "work_id" varchar(36) NOT NULL,
        "token" varchar(64) NOT NULL UNIQUE,
        "created_by" varchar(36) NOT NULL,
        "expires_at" timestamp,
        "view_count" int NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shares"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "export_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "generations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "works"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
