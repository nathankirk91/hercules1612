import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getManageAddToastMessage,
  isManageAddIntent,
  shouldShowInlineManageMessage,
} from "./manage-add-feedback.ts";

test("isManageAddIntent identifies add section and question intents", () => {
  assert.equal(isManageAddIntent("add-section"), true);
  assert.equal(isManageAddIntent("add-question"), true);
  assert.equal(isManageAddIntent("update"), false);
  assert.equal(isManageAddIntent(undefined), false);
});

test("getManageAddToastMessage returns labels for add intents", () => {
  assert.equal(getManageAddToastMessage("add-section"), "Section added");
  assert.equal(getManageAddToastMessage("add-question"), "Question added");
  assert.equal(getManageAddToastMessage("update"), null);
});

test("shouldShowInlineManageMessage hides add intents", () => {
  assert.equal(
    shouldShowInlineManageMessage({
      ok: true,
      intent: "add-question",
      message: "Question added.",
    }),
    false,
  );
  assert.equal(
    shouldShowInlineManageMessage({
      ok: true,
      intent: "add-section",
      message: "Section added.",
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
