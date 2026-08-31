-- Configurable sectioned inspection records (opt-in per template).

DO $$ BEGIN
  CREATE TYPE "inspection_workflow_mode" AS ENUM ('SINGLE_SUBMIT', 'SECTIONED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "inspection_day_record_policy" AS ENUM ('ONE', 'PER_SHIFT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "inspection_section_order" AS ENUM ('ANY', 'STRICT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "inspection_run_section_status" AS ENUM ('COMPLETE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "inspection_run_status" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "inspection_run_status" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "workflow_mode" "inspection_workflow_mode" NOT NULL DEFAULT 'SINGLE_SUBMIT';
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "day_record_policy" "inspection_day_record_policy" NOT NULL DEFAULT 'ONE';
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "section_order" "inspection_section_order" NOT NULL DEFAULT 'ANY';

ALTER TABLE "inspection_sections" ADD COLUMN IF NOT EXISTS "skip_when_question_id" TEXT;
ALTER TABLE "inspection_sections" ADD COLUMN IF NOT EXISTS "skip_when_equals" TEXT;

ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "started_by_id" TEXT;
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "record_date" VARCHAR(10);
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "shift" TEXT;
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMPTZ(6);
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "voided_by_id" TEXT;
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;

CREATE INDEX IF NOT EXISTS "inspection_runs_inspection_id_record_date_shift_idx"
  ON "inspection_runs"("inspection_id", "record_date", "shift");

CREATE UNIQUE INDEX IF NOT EXISTS "inspection_runs_active_record_key"
  ON "inspection_runs" (
    "inspection_id",
    COALESCE("equipment_ref", ''),
    "record_date",
    COALESCE("shift", '')
  )
  WHERE "record_date" IS NOT NULL AND "voided_at" IS NULL;

DO $$ BEGIN
  ALTER TABLE "inspection_runs"
    ADD CONSTRAINT "inspection_runs_started_by_id_fkey"
    FOREIGN KEY ("started_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_runs"
    ADD CONSTRAINT "inspection_runs_voided_by_id_fkey"
    FOREIGN KEY ("voided_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "inspection_run_sections" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "status" "inspection_run_section_status" NOT NULL,
  "responses" JSONB NOT NULL,
  "signature" TEXT,
  "operator_user_id" TEXT,
  "completed_by_id" TEXT,
  "completed_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_run_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inspection_run_sections_run_id_section_id_key"
  ON "inspection_run_sections"("run_id", "section_id");
CREATE INDEX IF NOT EXISTS "inspection_run_sections_section_id_idx"
  ON "inspection_run_sections"("section_id");

DO $$ BEGIN
  ALTER TABLE "inspection_run_sections"
    ADD CONSTRAINT "inspection_run_sections_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "inspection_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_run_sections"
    ADD CONSTRAINT "inspection_run_sections_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "inspection_sections"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_run_sections"
    ADD CONSTRAINT "inspection_run_sections_operator_user_id_fkey"
    FOREIGN KEY ("operator_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_run_sections"
    ADD CONSTRAINT "inspection_run_sections_completed_by_id_fkey"
    FOREIGN KEY ("completed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
