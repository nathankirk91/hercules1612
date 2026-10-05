import { z } from "zod";

export type PushDeviceSummary = {
  id: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
};

export const removePushDeviceSchema = z.object({
  intent: z.literal("remove-device"),
  subscriptionId: z.string().trim().min(1, "Missing device id."),
});
