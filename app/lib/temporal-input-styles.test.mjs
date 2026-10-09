import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("temporal input stretch styles", () => {
  it("forces date/time controls to fill available width", () => {
    const css = readFileSync(join(root, "app/app.css"), "utf8");
    assert.match(css, /input\[type="date"\]/);
    assert.match(css, /input\[type="time"\]/);
    assert.match(css, /::-webkit-datetime-edit/);
    assert.match(css, /width:\s*100%/);

    const input = readFileSync(
      join(root, "app/components/ui/input.tsx"),
      "utf8",
    );
    assert.match(input, /temporalInputTypes/);
    assert.match(input, /\[&::-webkit-datetime-edit\]:w-full/);
  });

  it("permit forms use ShadCN date and time picker fields", () => {
    const issue = readFileSync(
      join(root, "app/components/permit-issue-form.tsx"),
      "utf8",
    );
    assert.match(issue, /DatePickerField/);
    assert.match(issue, /TimePickerField/);
    assert.equal(/type="date"/.test(issue), false);
    assert.equal(/type="time"/.test(issue), false);

    const run = readFileSync(join(root, "app/routes/permit-run.tsx"), "utf8");
    assert.match(run, /DatePickerField/);
    assert.match(run, /TimePickerField/);

    const dateField = readFileSync(
      join(root, "app/components/date-picker-field.tsx"),
      "utf8",
    );
    assert.match(dateField, /Calendar/);
    assert.match(dateField, /Popover/);
    assert.match(dateField, /Today/);
    assert.match(dateField, /Tomorrow/);
    assert.match(dateField, /todayYmd/);
    assert.match(dateField, /tomorrowYmd/);

    const timeField = readFileSync(
      join(root, "app/components/time-picker-field.tsx"),
      "utf8",
    );
    assert.match(timeField, /Select/);
    assert.match(timeField, /HOUR_OPTIONS/);
  });
});
