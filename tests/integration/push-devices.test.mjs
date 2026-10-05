import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

const {
  inferDeviceNameFromUserAgent,
  resolveDeviceName,
} = await import("../../app/lib/device-name.ts");
const {
  findPushDeviceByEndpoint,
  removePushDeviceSchema,
  testPushDeviceSchema,
} = await import("../../app/lib/push-devices.ts");

/**
 * Integration: device naming + Settings → Notifications form contracts
 * (remove-device, test-push scoped to one endpoint).
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
  const devices = [
    {
      id: "phone",
      deviceName: "Safari on iPhone",
      endpoint: "https://web.push.apple.com/phone",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "laptop",
      deviceName: "Chrome on Mac",
      endpoint: "https://fcm.googleapis.com/fcm/send/laptop",
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
  ];
  const current = findPushDeviceByEndpoint(
    devices,
    "https://fcm.googleapis.com/fcm/send/laptop",
  );
  assert.ok(current);
  assert.equal(current.id, "laptop");
  assert.notEqual(
    findPushDeviceByEndpoint(devices, "https://web.push.apple.com/phone")?.id,
    current.id,
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

{
  const formData = new FormData();
  formData.set("intent", "test-push");
  formData.set("endpoint", "https://fcm.googleapis.com/fcm/send/this-device");
  const submission = parseWithZod(formData, { schema: testPushDeviceSchema });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.equal(
      submission.value.endpoint,
      "https://fcm.googleapis.com/fcm/send/this-device",
    );
  }
}

{
  // Test push without an endpoint must fail — prevents broadcasting to every device.
  const formData = new FormData();
  formData.set("intent", "test-push");
  const submission = parseWithZod(formData, { schema: testPushDeviceSchema });
  assert.equal(submission.status, "error");
}

console.log("push devices integration tests passed");
