import assert from "node:assert/strict";

const {
  MAX_DEVICE_NAME_LENGTH,
  inferDeviceNameFromUserAgent,
  normalizeDeviceName,
  resolveDeviceName,
} = await import("./device-name.ts");

{
  assert.equal(normalizeDeviceName(null), null);
  assert.equal(normalizeDeviceName(undefined), null);
  assert.equal(normalizeDeviceName("   "), null);
  assert.equal(normalizeDeviceName("  Chrome on Mac  "), "Chrome on Mac");
  assert.equal(
    normalizeDeviceName("a".repeat(MAX_DEVICE_NAME_LENGTH + 20))?.length,
    MAX_DEVICE_NAME_LENGTH,
  );
}

{
  assert.equal(
    inferDeviceNameFromUserAgent(null),
    "Unknown device",
  );
  assert.equal(
    inferDeviceNameFromUserAgent(""),
    "Unknown device",
  );
  assert.equal(
    inferDeviceNameFromUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    "Safari on iPhone",
  );
  assert.equal(
    inferDeviceNameFromUserAgent(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    ),
    "Chrome on Android",
  );
  assert.equal(
    inferDeviceNameFromUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ),
    "Edge on Windows PC",
  );
  assert.equal(
    inferDeviceNameFromUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    ),
    "Firefox on Mac",
  );
}

{
  assert.equal(
    resolveDeviceName({ deviceName: "  Desk phone  ", userAgent: "garbage" }),
    "Desk phone",
  );
  assert.equal(
    resolveDeviceName({
      deviceName: "   ",
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1",
    }),
    "Safari on iPad",
  );
  assert.equal(
    resolveDeviceName({ deviceName: null, userAgent: null }),
    "Unknown device",
  );
}

console.log("device-name tests passed");
