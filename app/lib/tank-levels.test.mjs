import assert from "node:assert/strict";

const {
  DEFAULT_TANKS,
  normalizeTankCode,
  isOverCapacity,
  overCapacityWarning,
  canLogTankLevelsToday,
  canEditTankLevelsForDay,
  canManageTanks,
  summarizeTankDay,
} = await import("./tank-levels.ts");

assert.equal(DEFAULT_TANKS.length, 19);
assert.equal(
  DEFAULT_TANKS.some((tank) => tank.code.includes("*")),
  false,
);
assert.deepEqual(
  DEFAULT_TANKS.find((tank) => tank.code === "T454"),
  {
    code: "T454",
    product: "HXHCE",
    capacityKg: 55000,
    sortOrder: 150,
  },
);
assert.equal(
  DEFAULT_TANKS.find((tank) => tank.code === "F501")?.capacityKg,
  6500,
);

assert.equal(normalizeTankCode("T454*"), "T454");
assert.equal(normalizeTankCode(" t455** "), "T455");
assert.equal(normalizeTankCode("f114"), "F114");

assert.equal(isOverCapacity(40000, 40000), false);
assert.equal(isOverCapacity(40001, 40000), true);
assert.equal(overCapacityWarning(100, 40000), null);
assert.match(overCapacityWarning(50000, 40000) ?? "", /Over capacity/);

assert.equal(canLogTankLevelsToday("STANDARD"), true);
assert.equal(canLogTankLevelsToday("APPROVER"), true);
assert.equal(canLogTankLevelsToday("ADMIN"), true);

assert.equal(
  canEditTankLevelsForDay("STANDARD", "2026-11-27", "2026-11-27"),
  true,
);
assert.equal(
  canEditTankLevelsForDay("STANDARD", "2026-11-26", "2026-11-27"),
  false,
);
assert.equal(
  canEditTankLevelsForDay("APPROVER", "2026-11-26", "2026-11-27"),
  false,
);
assert.equal(
  canEditTankLevelsForDay("ADMIN", "2026-11-26", "2026-11-27"),
  true,
);

assert.equal(canManageTanks("STANDARD"), false);
assert.equal(canManageTanks("APPROVER"), false);
assert.equal(canManageTanks("ADMIN"), true);

const summary = summarizeTankDay({
  totalActive: 19,
  loggedCount: 5,
  lastUpdatedAt: null,
});
assert.equal(summary.missingCount, 14);
assert.equal(summary.complete, false);

const complete = summarizeTankDay({
  totalActive: 2,
  loggedCount: 2,
  lastUpdatedAt: new Date(),
});
assert.equal(complete.complete, true);
assert.equal(complete.missingCount, 0);

console.log("tank-levels tests passed");
