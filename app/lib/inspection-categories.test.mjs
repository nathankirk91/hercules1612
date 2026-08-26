import assert from "node:assert/strict";

const { PERMIT_CATEGORY } = await import("./inspections.ts");

{
  assert.equal(PERMIT_CATEGORY, "Permits");
  assert.equal(PERMIT_CATEGORY.toLowerCase(), "permits");
}

{
  // Category dropdowns and CRUD must keep Permits out of plant inspections.
  const managedNames = ["Equipment", "Shift", "General", "Permits"];
  const inspectionDropdown = managedNames.filter(
    (name) => name.toLowerCase() !== PERMIT_CATEGORY.toLowerCase(),
  );
  assert.deepEqual(inspectionDropdown, ["Equipment", "Shift", "General"]);
}

console.log("inspection-categories unit tests passed");
