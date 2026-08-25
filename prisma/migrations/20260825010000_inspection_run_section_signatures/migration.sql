-- AlterTable
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "section_signatures" JSONB;
