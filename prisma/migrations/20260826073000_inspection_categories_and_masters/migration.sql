-- CreateTable
CREATE TABLE IF NOT EXISTS "inspection_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inspection_categories_name_key" ON "inspection_categories"("name");
CREATE INDEX IF NOT EXISTS "inspection_categories_is_active_sort_order_idx" ON "inspection_categories"("is_active", "sort_order");

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "is_master_template" BOOLEAN NOT NULL DEFAULT false;

-- Backfill masters that already have derived unit forms
UPDATE "inspections" AS parent
SET "is_master_template" = true
WHERE parent."template_inspection_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "inspections" AS child
    WHERE child."template_inspection_id" = parent."id"
  );

-- Seed categories from existing inspection category strings (non-empty)
INSERT INTO "inspection_categories" ("id", "name", "sort_order", "is_active")
SELECT
  md5('category:' || lower(trimmed.name)) AS id,
  trimmed.name,
  ROW_NUMBER() OVER (ORDER BY lower(trimmed.name)) - 1 AS sort_order,
  true
FROM (
  SELECT DISTINCT trim("category") AS name
  FROM "inspections"
  WHERE trim("category") <> ''
) AS trimmed
ON CONFLICT ("name") DO NOTHING;

-- Ensure common defaults exist
INSERT INTO "inspection_categories" ("id", "name", "sort_order", "is_active")
VALUES
  (md5('category:equipment'), 'Equipment', 0, true),
  (md5('category:shift'), 'Shift', 1, true),
  (md5('category:general'), 'General', 2, true)
ON CONFLICT ("name") DO NOTHING;
