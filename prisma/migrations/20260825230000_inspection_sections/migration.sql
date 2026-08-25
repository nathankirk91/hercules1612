-- CreateTable
CREATE TABLE IF NOT EXISTS "inspection_sections" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requires_signature" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_sections_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "section_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inspection_sections_inspection_id_is_active_sort_order_idx" ON "inspection_sections"("inspection_id", "is_active", "sort_order");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inspection_sections"
    ADD CONSTRAINT "inspection_sections_inspection_id_fkey"
    FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_questions"
    ADD CONSTRAINT "inspection_questions_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "inspection_sections"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
