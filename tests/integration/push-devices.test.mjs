import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

const {
  inferDeviceNameFromUserAgent,
  resolveDeviceName,
} = await import("../../app/lib/device-name.ts");
const { removePushDeviceSchema } = await import(
  "../../app/lib/push-devices.ts"
);

/**
 * Integration: device naming + remove-device form contract used by
 * Settings → Notifications.
 */

{
  const named = resolveDeviceName({
    deviceName: "Plant floor iPad",
    userAgent: "Mozilla/5.0 (iPad)",
  });
  assert.equal(named, "Plant floor iPad");

  const inferred = resolveDeviceName({
    deviceName: null,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36",
  });
  assert.equal(inferred, "Chrome on Android");
  assert.equal(
    inferDeviceNameFromUserAgent(
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    ),
    "Chrome on Chromebook",
  );
}

{
  const formData = new FormData();
  formData.set("intent", "remove-device");
  formData.set("subscriptionId", "clxxxxxxxxxxxxxxxxxx");
  const submission = parseWithZod(formData, {
    schema: removePushDeviceSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.equal(submission.value.intent, "remove-device");
    assert.equal(submission.value.subscriptionId, "clxxxxxxxxxxxxxxxxxx");
  }
}

{
  const formData = new FormData();
  formData.set("intent", "remove-device");
  formData.set("subscriptionId", "   ");
  const submission = parseWithZod(formData, {
    schema: removePushDeviceSchema,
  });
  assert.equal(submission.status, "error");
}

{
  const formData = new FormData();
  formData.set("intent", "save-preferences");
  formData.set("subscriptionId", "abc");
  const submission = parseWithZod(formData, {
    schema: removePushDeviceSchema,
  });
  assert.equal(submission.status, "error");
}

console.log("push devices integration tests passed");
