import { Form, Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { InspectionRecordSlotView } from "~/lib/inspection-record.server";
import { formatMelbourneYmd } from "~/lib/datetime";
import { cn } from "~/lib/utils";

type Props = {
  date: string;
  slots: InspectionRecordSlotView[];
  equipmentRef: string | null;
  equipmentLabel?: string | null;
  formError?: string | null;
};

function slotStatusLabel(slot: InspectionRecordSlotView): string {
  if (slot.status === "not_started") {
    return "Not started";
  }
  if (slot.status === "IN_PROGRESS") {
    return `${slot.total - slot.remaining} of ${slot.total} sections`;
  }
  if (slot.status === "PASSED") {
    return "Complete";
  }
  return "Complete — needs attention";
}

export function InspectionRecordBoard({
  date,
  slots,
  equipmentRef,
  equipmentLabel,
  formError,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today’s records</CardTitle>
        <CardDescription>
          {formatMelbourneYmd(date) ?? date}. Open a record to complete
          sections. Each record is independent.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}
        <ul className="grid gap-3">
          {slots.map((slot) => (
            <li
              key={slot.shift ?? "one"}
              className="rounded-lg border border-border/70 bg-background/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-navy">{slot.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {slotStatusLabel(slot)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    slot.status === "PASSED" &&
                      "border-emerald-600/40 text-emerald-700",
                    slot.status === "NEEDS_ATTENTION" &&
                      "border-amber-600/40 text-amber-800",
                    slot.status === "IN_PROGRESS" &&
                      "border-brand/40 text-brand-navy",
                  )}
                >
                  {slot.status === "not_started"
                    ? "Not started"
                    : slot.status === "IN_PROGRESS"
                      ? "In progress"
                      : slot.status === "PASSED"
                        ? "Passed"
                        : "Needs attention"}
                </Badge>
              </div>
              <div className="mt-4">
                {slot.runId && slot.status === "IN_PROGRESS" ? (
                  <Button asChild>
                    <Link to={`records/${slot.runId}`}>Continue record</Link>
                  </Button>
                ) : slot.runId &&
                  (slot.status === "PASSED" ||
                    slot.status === "NEEDS_ATTENTION") ? (
                  <Button asChild variant="outline">
                    <Link to={`/inspections/submissions/${slot.runId}`}>
                      View record
                    </Link>
                  </Button>
                ) : (
                  <Form method="post" className="grid gap-3">
                    <input type="hidden" name="intent" value="open-record" />
                    {slot.shift ? (
                      <input type="hidden" name="shift" value={slot.shift} />
                    ) : null}
                    {equipmentRef ? (
                      <input
                        type="hidden"
                        name="equipmentRef"
                        value={equipmentRef}
                      />
                    ) : equipmentLabel ? (
                      <input
                        name="equipmentRef"
                        required
                        placeholder={equipmentLabel}
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                      />
                    ) : null}
                    <Button type="submit">{slot.openLabel}</Button>
                  </Form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
