import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

const {
  findPushDeviceByEndpoint,
  removePushDeviceSchema,
  testPushDeviceSchema,
} = await import("./push-devices.ts");

{
  const devices = [
    {
      id: "a",
      deviceName: "Safari on iPhone",
      endpoint: "https://push.example/a",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "b",
      deviceName: "Chrome on Mac",
      endpoint: "https://push.example/b",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  assert.equal(findPushDeviceByEndpoint(devices, null), null);
  assert.equal(findPushDeviceByEndpoint(devices, "   "), null);
  assert.equal(
    findPushDeviceByEndpoint(devices, "https://push.example/missing"),
    null,
  );
  assert.equal(
    findPushDeviceByEndpoint(devices, "https://push.example/b")?.deviceName,
    "Chrome on Mac",
  );
  assert.equal(
    findPushDeviceByEndpoint(devices, "  https://push.example/a  ")?.id,
    "a",
  );
}

{
  const formData = new FormData();
  formData.set("intent", "test-push");
  formData.set("endpoint", "https://fcm.googleapis.com/fcm/send/abc");
  const submission = parseWithZod(formData, { schema: testPushDeviceSchema });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.equal(submission.value.intent, "test-push");
    assert.equal(
      submission.value.endpoint,
      "https://fcm.googleapis.com/fcm/send/abc",
    );
  }
}

{
  const formData = new FormData();
  formData.set("intent", "test-push");
  formData.set("endpoint", "   ");
  const submission = parseWithZod(formData, { schema: testPushDeviceSchema });
  assert.equal(submission.status, "error");
}

{
  const formData = new FormData();
  formData.set("intent", "test-push");
  const submission = parseWithZod(formData, { schema: testPushDeviceSchema });
  assert.equal(submission.status, "error");
}

{
  const formData = new FormData();
  formData.set("intent", "remove-device");
  formData.set("subscriptionId", "cldevice");
  const submission = parseWithZod(formData, {
    schema: removePushDeviceSchema,
  });
  assert.equal(submission.status, "success");
}

console.log("push-devices unit tests passed");
