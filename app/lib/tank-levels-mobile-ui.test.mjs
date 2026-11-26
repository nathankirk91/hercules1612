import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("tank levels mobile day form", () => {
  it("uses stacked cards with large Level inputs, not a squeezed table", () => {
    const form = readFileSync(
      join(root, "app/components/tank-levels-day-form.tsx"),
      "utf8",
    );

    assert.equal(/<table\b/.test(form), false, "day form must not use a table");
    assert.equal(
      /min-w-\[40rem\]/.test(form),
      false,
      "day form must not force a wide min-width",
    );
    assert.match(form, /Level \(kg\)/);
    assert.match(form, /h-12 w-full/);
    assert.match(form, /sticky bottom-0/);
    assert.match(form, /Save levels/);
    assert.match(form, /tankLevelFieldName/);
    assert.match(form, /shouldValidate:\s*"onBlur"/);
    assert.match(form, /shouldRevalidate:\s*"onBlur"/);
  });
});
