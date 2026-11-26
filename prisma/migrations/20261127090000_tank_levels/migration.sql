-- Daily bulk tank levels: roster + per-day kg readings.

CREATE TABLE IF NOT EXISTS "tanks" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "capacity_kg" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tanks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tanks_code_key" ON "tanks"("code");
CREATE INDEX IF NOT EXISTS "tanks_is_active_sort_order_idx" ON "tanks"("is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "tank_level_readings" (
  "id" TEXT NOT NULL,
  "tank_id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "level_kg" INTEGER NOT NULL,
  "recorded_by_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tank_level_readings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tank_level_readings_tank_id_day_key"
  ON "tank_level_readings"("tank_id", "day");
CREATE INDEX IF NOT EXISTS "tank_level_readings_day_idx"
  ON "tank_level_readings"("day");
CREATE INDEX IF NOT EXISTS "tank_level_readings_day_tank_id_idx"
  ON "tank_level_readings"("day", "tank_id");

DO $$ BEGIN
  ALTER TABLE "tank_level_readings"
    ADD CONSTRAINT "tank_level_readings_tank_id_fkey"
    FOREIGN KEY ("tank_id") REFERENCES "tanks"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tank_level_readings"
    ADD CONSTRAINT "tank_level_readings_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
