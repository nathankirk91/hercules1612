import assert from "node:assert/strict";

const { canHardDeleteInspections } = await import("../../app/lib/roles.ts");
const { hardDeleteManagedInspection } = await import(
  "../../app/lib/inspections.server.ts"
);

assert.equal(canHardDeleteInspections("ADMIN"), true);
assert.equal(canHardDeleteInspections("APPROVER"), false);
assert.equal(canHardDeleteInspections("STANDARD"), false);

await assert.rejects(
  () => hardDeleteManagedInspection(""),
  (error) =>
    error instanceof Error &&
    (error.message === "Database is not configured." ||
      error.message === "Form not found."),
);

console.log("hard-delete inspection integration tests passed");
