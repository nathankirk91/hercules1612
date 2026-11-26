import assert from "node:assert/strict";

const { tankDaySaveSchema, tankUpsertSchema } = await import(
  "../../app/lib/tank-levels.schema.ts"
);

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

console.log("tank-levels schema integration tests passed");
