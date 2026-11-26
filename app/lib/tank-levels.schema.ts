import { z } from "zod";

import { normalizeTankCode } from "~/lib/tank-levels";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

const optionalNonNegativeKg = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: "Enter a valid level (kg)." })
    .int("Level must be a whole number of kg.")
    .nonnegative("Level cannot be negative.")
    .optional(),
);

/**
 * Day log: `day` plus `levelKg.<tankId>` fields.
 *
 * Conform's path parser only accepts numeric brackets (`items[0]`), so cuid
 * keys must use dot notation (`levelKg.cm…`). Empty values are skipped (do
 * not wipe existing readings).
 */
export const tankDaySaveSchema = z
  .object({
    day: z
      .string({ error: "Choose a date." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
    levelKg: z.record(z.string(), optionalNonNegativeKg).optional(),
  })
  .transform((value) => {
    const entries: Array<{ tankId: string; levelKg: number }> = [];
    for (const [tankId, levelKg] of Object.entries(value.levelKg ?? {})) {
      if (levelKg == null || !tankId) {
        continue;
      }
      entries.push({ tankId, levelKg });
    }
    return { day: value.day, entries };
  });

export type TankDaySaveValue = z.infer<typeof tankDaySaveSchema>;

/** Form field name for a tank level input (Conform-compatible). */
export function tankLevelFieldName(tankId: string): string {
  return `levelKg.${tankId}`;
}

export const tankUpsertSchema = z.object({
  intent: z.enum(["create", "update"]),
  tankId: z.string().optional(),
  code: z
    .string({ error: "Enter a tank code." })
    .trim()
    .min(1, "Enter a tank code.")
    .transform(normalizeTankCode)
    .pipe(z.string().min(1, "Enter a tank code.")),
  product: z
    .string({ error: "Enter a product." })
    .trim()
    .min(1, "Enter a product."),
  capacityKg: z.coerce
    .number({ error: "Enter capacity (kg)." })
    .int("Capacity must be a whole number.")
    .positive("Capacity must be greater than zero."),
  sortOrder: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Enter a sort order." })
      .int("Sort order must be a whole number.")
      .default(0),
  ),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
    .optional()
    .transform((value) => value === "on" || value === "true" || value === "1"),
});

export type TankUpsertValue = z.infer<typeof tankUpsertSchema>;
