import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

const {
  tankDaySaveSchema,
  tankUpsertSchema,
  tankLevelFieldName,
} = await import("../../app/lib/tank-levels.schema.ts");

const dayOk = tankDaySaveSchema.safeParse({
  day: "2026-11-27",
  levelKg: {
    tankA: "",
    tankB: "1200",
    tankC: "0",
  },
});
assert.equal(dayOk.success, true);
if (dayOk.success) {
  assert.equal(dayOk.data.day, "2026-11-27");
  assert.deepEqual(dayOk.data.entries, [
    { tankId: "tankB", levelKg: 1200 },
    { tankId: "tankC", levelKg: 0 },
  ]);
}

const dayBad = tankDaySaveSchema.safeParse({
  day: "2026-11-27",
  levelKg: { tankA: "-1" },
});
assert.equal(dayBad.success, false);

const dayOverCapacityStillOk = tankDaySaveSchema.safeParse({
  day: "2026-11-27",
  levelKg: { tankA: "999999" },
});
assert.equal(dayOverCapacityStillOk.success, true);

const createOk = tankUpsertSchema.safeParse({
  intent: "create",
  code: "T454*",
  product: "HXHCE",
  capacityKg: "55000",
  sortOrder: "10",
  isActive: "on",
});
assert.equal(createOk.success, true);
if (createOk.success) {
  assert.equal(createOk.data.code, "T454");
  assert.equal(createOk.data.capacityKg, 55000);
  assert.equal(createOk.data.isActive, true);
}

const createMissingProduct = tankUpsertSchema.safeParse({
  intent: "create",
  code: "X1",
  product: "",
  capacityKg: "100",
});
assert.equal(createMissingProduct.success, false);

const cuid = "cmwy45buj000008jym8i85ewk";
assert.equal(tankLevelFieldName(cuid), `levelKg.${cuid}`);

// Conform drops bracket keys with non-numeric segments (cuids). Dot notation
// is required for levelKg.<tankId> to appear in the parsed payload.
{
  const broken = new FormData();
  broken.set("day", "2026-11-27");
  broken.set(`levelKg[${cuid}]`, "12345");
  const brokenSubmission = parseWithZod(broken, { schema: tankDaySaveSchema });
  assert.equal(brokenSubmission.status, "success");
  if (brokenSubmission.status === "success") {
    assert.deepEqual(
      brokenSubmission.value.entries,
      [],
      "bracket cuid keys must not silently parse as entries",
    );
  }
}

{
  const ok = new FormData();
  ok.set("day", "2026-11-27");
  ok.set(tankLevelFieldName(cuid), "12345");
  ok.set(tankLevelFieldName("other"), "");
  const okSubmission = parseWithZod(ok, { schema: tankDaySaveSchema });
  assert.equal(okSubmission.status, "success");
  if (okSubmission.status === "success") {
    assert.deepEqual(okSubmission.value.entries, [
      { tankId: cuid, levelKg: 12345 },
    ]);
  }
}

console.log("tank-levels schema integration tests passed");
