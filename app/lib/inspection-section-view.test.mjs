import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regression: completed sections must offer a view-only report entry point.
 */
const recordSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../routes/inspection-record.tsx"),
  "utf8",
);
const sectionSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../routes/inspection-record-section.tsx",
  ),
  "utf8",
);

assert.match(
  recordSource,
  /item\.status === "complete"[\s\S]*View report/,
  "record board must link completed sections to a view report",
);

assert.match(
  sectionSource,
  /mode: "view"/,
  "section route must support a view-only mode",
);

assert.match(
  sectionSource,
  /InspectionSectionReport/,
  "section route must render the read-only section report",
);

const reportComponent = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/inspection-section-report.tsx",
  ),
  "utf8",
);
assert.match(
  reportComponent,
  /report\.notes/,
  "section report must render saved notes",
);

assert.match(
  sectionSource,
  /This section can no longer be edited/,
  "section action must reject edits for non-available sections",
);

console.log("inspection-section-view regression tests passed");
