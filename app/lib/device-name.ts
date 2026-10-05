export const MAX_DEVICE_NAME_LENGTH = 120;

const FALLBACK_DEVICE_NAME = "Unknown device";

/**
 * Trim and clamp a client-provided device label. Empty / junk → null so callers
 * can fall back to user-agent inference.
 */
export function normalizeDeviceName(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_DEVICE_NAME_LENGTH);
}

/**
 * Best-effort human label from a User-Agent string for older subscriptions
 * or when the client did not send a name.
 */
export function inferDeviceNameFromUserAgent(
  userAgent: string | null | undefined,
): string {
  if (!userAgent || !userAgent.trim()) {
    return FALLBACK_DEVICE_NAME;
  }

  const ua = userAgent.trim();

  let device = "Device";
  if (/iPhone/i.test(ua)) {
    device = "iPhone";
  } else if (/iPad/i.test(ua)) {
    device = "iPad";
  } else if (/Android/i.test(ua)) {
    device = "Android";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = "Mac";
  } else if (/Windows/i.test(ua)) {
    device = "Windows PC";
  } else if (/CrOS/i.test(ua)) {
    device = "Chromebook";
  } else if (/Linux/i.test(ua)) {
    device = "Linux";
  }

  let browser = "Browser";
  if (/Edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = "Chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = "Safari";
  }

  return normalizeDeviceName(`${browser} on ${device}`) ?? FALLBACK_DEVICE_NAME;
}

/**
 * Resolve the stored device name: prefer an explicit label, else infer from UA.
 */
export function resolveDeviceName(args: {
  deviceName?: string | null;
  userAgent?: string | null;
}): string {
  return (
    normalizeDeviceName(args.deviceName) ??
    inferDeviceNameFromUserAgent(args.userAgent)
  );
}
