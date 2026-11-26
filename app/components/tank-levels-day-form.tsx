import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useNavigation } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatMelbourneYmd } from "~/lib/datetime";
import { overCapacityWarning } from "~/lib/tank-levels";
import {
  tankDaySaveSchema,
  tankLevelFieldName,
} from "~/lib/tank-levels.schema";
import type { TankDayRow } from "~/lib/tank-levels.server";
import { cn } from "~/lib/utils";

type Props = {
  day: string;
  rows: TankDayRow[];
  canEdit: boolean;
  canManage: boolean;
  loggedCount: number;
  lastResult?: SubmissionResult<string[]> | null;
  formError?: string | null;
  message?: string | null;
  warnings?: Record<string, string>;
};

export function TankLevelsDayForm({
  day,
  rows,
  canEdit,
  canManage,
  loggedCount,
  lastResult,
  formError,
  message,
  warnings = {},
}: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const dayLabel = formatMelbourneYmd(day) ?? day;

  const defaultLevelKg: Record<string, string> = {};
  for (const row of rows) {
    defaultLevelKg[row.id] =
      row.levelKg == null ? "" : String(row.levelKg);
  }

  const [form] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: tankDaySaveSchema });
    },
    // Validate only after the user leaves a field (and on submit).
    shouldValidate: "onBlur",
    shouldRevalidate: "onBlur",
    defaultValue: {
      day,
      levelKg: defaultLevelKg,
    },
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-brand-navy">
              Levels for {dayLabel}
            </CardTitle>
            <CardDescription className="mt-1">
              {loggedCount} of {rows.length} tanks logged · values in kg.
              Partial saves are fine — blanks stay blank.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/tank-levels/manage">Manage tanks</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Form
          method="get"
          preventScrollReset
          className="flex flex-wrap items-end gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="tank-levels-day">Date</Label>
            <Input
              id="tank-levels-day"
              name="date"
              type="date"
              defaultValue={day}
              className="w-auto"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Show day
          </Button>
        </Form>
      </CardHeader>

      <Form method="post" {...getFormProps(form)}>
        <input type="hidden" name="day" value={day} />
        <CardContent className="grid gap-4 pb-6">
          {!canEdit ? (
            <Alert>
              <AlertTitle>Read only</AlertTitle>
              <AlertDescription>
                Only admins can change levels for previous days. Switch to
                today to log or edit.
              </AlertDescription>
            </Alert>
          ) : null}

          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {message ? (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Tank</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Capacity</th>
                  <th className="px-3 py-2 font-medium">Level (kg)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const warn =
                    warnings[row.id] ??
                    (row.levelKg != null
                      ? overCapacityWarning(row.levelKg, row.capacityKg)
                      : null);
                  const inputName = tankLevelFieldName(row.id);
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium text-brand-navy">
                        {row.code}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.product}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.capacityKg.toLocaleString("en-AU")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="grid gap-1">
                          <Input
                            name={inputName}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            defaultValue={
                              row.levelKg == null ? "" : String(row.levelKg)
                            }
                            disabled={!canEdit || isSubmitting}
                            className={cn(
                              "max-w-[10rem] tabular-nums",
                              warn && "border-amber-500",
                            )}
                            aria-label={`${row.code} level kg`}
                          />
                          {warn ? (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              {warn}
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active tanks yet.
              {canManage ? (
                <>
                  {" "}
                  <Link
                    to="/tank-levels/manage"
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    Add tanks
                  </Link>{" "}
                  or sync the seed roster.
                </>
              ) : (
                " Ask an admin to set up the tank roster."
              )}
            </p>
          ) : null}
        </CardContent>
        {canEdit ? (
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || rows.length === 0}>
              {isSubmitting ? "Saving…" : "Save levels"}
            </Button>
          </CardFooter>
        ) : null}
      </Form>
    </Card>
  );
}
