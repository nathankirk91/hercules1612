-- Soft-archive for permit and inspection records (approver/admin with comment).
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT;
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;

ALTER TABLE "permit_runs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "permit_runs" ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT;
ALTER TABLE "permit_runs" ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;

CREATE INDEX IF NOT EXISTS "inspection_runs_archived_at_idx"
  ON "inspection_runs"("archived_at");
CREATE INDEX IF NOT EXISTS "permit_runs_archived_at_idx"
  ON "permit_runs"("archived_at");

DO $$ BEGIN
  ALTER TABLE "inspection_runs"
    ADD CONSTRAINT "inspection_runs_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "permit_runs"
    ADD CONSTRAINT "permit_runs_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Archived sectioned records free the active slot (same as voided).
DROP INDEX IF EXISTS "inspection_runs_active_record_key";
CREATE UNIQUE INDEX IF NOT EXISTS "inspection_runs_active_record_key"
  ON "inspection_runs" (
    "inspection_id",
    COALESCE("equipment_ref", ''),
    "record_date",
    COALESCE("shift", '')
  )
  WHERE "record_date" IS NOT NULL
    AND "voided_at" IS NULL
    AND "archived_at" IS NULL;
