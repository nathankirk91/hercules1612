import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regression: Conform list insert/remove must submit (not type="button"),
 * and the inspection form must not ask operators to pick a creator.
 */
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/inspection-checklist-form.tsx"),
  "utf8",
);

assert.match(
  source,
  /form\.insert\.getButtonProps\(\{\s*name: fields\.actions\.name/,
  "expected Conform insert control for actions",
);

assert.doesNotMatch(
  source,
  /type=["']button["'][\s\S]{0,120}form\.insert\.getButtonProps/,
  "Add action must not override Conform insert with type=button",
);

assert.doesNotMatch(
  source,
  /type=["']button["'][\s\S]{0,120}form\.remove\.getButtonProps/,
  "Remove action must not override Conform remove with type=button",
);

assert.doesNotMatch(
  source,
  /who filled out this form/i,
  "creator/filler dropdown must be removed from the checklist form",
);

assert.doesNotMatch(
  source,
  /operators:\s*OperatorOption/,
  "checklist form must not take an operators list for creator selection",
);

console.log("inspection-checklist-form regression tests passed");
