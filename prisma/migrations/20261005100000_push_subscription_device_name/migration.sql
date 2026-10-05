-- Add a human-readable device label for Settings → Notifications device list.
ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "device_name" TEXT;
