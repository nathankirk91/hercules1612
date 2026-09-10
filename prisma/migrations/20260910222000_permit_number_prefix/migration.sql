-- Optional two-letter prefix for newly issued permit numbers (per form).
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "permit_number_prefix" VARCHAR(2);
