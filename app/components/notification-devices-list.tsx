import { useFetcher } from "react-router";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { formatMelbourneDateTime } from "~/lib/datetime";
import type { PushDeviceSummary } from "~/lib/push-devices";

type RemoveDeviceResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  removedSubscriptionId?: string;
};

type Props = {
  devices: PushDeviceSummary[];
};

export function NotificationDevicesList({ devices }: Props) {
  const fetcher = useFetcher<RemoveDeviceResult>();

  const removingId =
    fetcher.state !== "idle"
      ? String(fetcher.formData?.get("subscriptionId") ?? "")
      : "";

  const pendingRemovalId =
    fetcher.data?.ok && fetcher.data.removedSubscriptionId
      ? fetcher.data.removedSubscriptionId
      : null;

  const visibleDevices = pendingRemovalId
    ? devices.filter((device) => device.id !== pendingRemovalId)
    : devices;

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="font-medium">Registered devices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Devices that will receive push alerts for this account. Remove any you
          no longer want notified.
        </p>
      </div>

      {fetcher.data && "error" in fetcher.data && fetcher.data.error ? (
        <Alert variant="destructive">
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      ) : null}

      {fetcher.data?.ok && fetcher.data.message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {fetcher.data.message}
        </p>
      ) : null}

      {visibleDevices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No devices registered yet. Enable push on a phone or computer above.
        </p>
      ) : (
        <ul className="grid gap-2">
          {visibleDevices.map((device) => {
            const registeredAt = formatMelbourneDateTime(device.createdAt);
            const isRemoving = removingId === device.id;
            return (
              <li
                key={device.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{device.deviceName}</p>
                  {registeredAt ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Registered {registeredAt}
                    </p>
                  ) : null}
                </div>
                <fetcher.Form method="post" className="shrink-0">
                  <input type="hidden" name="intent" value="remove-device" />
                  <input
                    type="hidden"
                    name="subscriptionId"
                    value={device.id}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={fetcher.state !== "idle"}
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </Button>
                </fetcher.Form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
