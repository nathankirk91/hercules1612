import assert from "node:assert/strict";

const { canDeleteUnusedForms } = await import("../../app/lib/roles.ts");
const { deleteUnusedManagedInspection } = await import(
  "../../app/lib/inspections.server.ts"
);

assert.equal(canDeleteUnusedForms("ADMIN"), true);
assert.equal(canDeleteUnusedForms("APPROVER"), false);
assert.equal(canDeleteUnusedForms("STANDARD"), false);

await assert.rejects(
  () => deleteUnusedManagedInspection(""),
  (error) =>
    error instanceof Error &&
    (error.message === "Database is not configured." ||
      error.message === "Form not found."),
);

console.log("delete-unused-form integration tests passed");
