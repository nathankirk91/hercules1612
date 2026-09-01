import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isManageAddIntent,
  shouldShowInlineManageMessage,
} from "./manage-add-feedback.ts";

test("isManageAddIntent identifies add section and question intents", () => {
  assert.equal(isManageAddIntent("add-section"), true);
  assert.equal(isManageAddIntent("add-question"), true);
  assert.equal(isManageAddIntent("update"), false);
  assert.equal(isManageAddIntent(undefined), false);
});

test("shouldShowInlineManageMessage hides add intents", () => {
  assert.equal(
    shouldShowInlineManageMessage({
      ok: true,
      intent: "add-question",
    }),
    false,
  );
  assert.equal(
    shouldShowInlineManageMessage({
      ok: true,
      intent: "add-section",
    }),
    false,
  );
  assert.equal(
    shouldShowInlineManageMessage({
      ok: true,
      intent: "update",
      message: "Details saved.",
    }),
    true,
  );
  assert.equal(shouldShowInlineManageMessage(undefined), false);
});
