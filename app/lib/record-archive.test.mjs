import assert from "node:assert/strict";

const { normalizeArchiveReason } = await import("./record-archive.ts");

assert.equal(normalizeArchiveReason("  Wrong equipment  "), "Wrong equipment");
assert.throws(
  () => normalizeArchiveReason(""),
  /archive comment is required/i,
);
assert.throws(
  () => normalizeArchiveReason("   "),
  /archive comment is required/i,
);

console.log("record-archive tests passed");
