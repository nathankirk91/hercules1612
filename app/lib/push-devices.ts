import { z } from "zod";

export type PushDeviceSummary = {
  id: string;
  deviceName: string;
  /** Push endpoint; used to match “this device” and scope test notifications. */
  endpoint: string;
  createdAt: string;
  updatedAt: string;
};

export const removePushDeviceSchema = z.object({
  intent: z.literal("remove-device"),
  subscriptionId: z.string().trim().min(1, "Missing device id."),
});

export const testPushDeviceSchema = z.object({
  intent: z.literal("test-push"),
  endpoint: z.string().trim().min(1, "Missing push endpoint."),
});

export function findPushDeviceByEndpoint(
  devices: PushDeviceSummary[],
  endpoint: string | null | undefined,
): PushDeviceSummary | null {
  const target = endpoint?.trim();
  if (!target) {
    return null;
  }
  return devices.find((device) => device.endpoint === target) ?? null;
}
