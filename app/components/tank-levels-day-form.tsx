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
  CardDescription,
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
    <div className="grid gap-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl text-brand-navy">
                Levels for {dayLabel}
              </CardTitle>
              <CardDescription className="mt-1">
                {loggedCount} of {rows.length} tanks logged · values in kg.
                Partial saves are fine — blanks stay blank.
              </CardDescription>
            </div>
            {canManage ? (
              <Button asChild variant="outline" size="lg" className="min-h-11">
                <Link to="/tank-levels/manage">Manage tanks</Link>
              </Button>
            ) : null}
          </div>

          <Form
            method="get"
            preventScrollReset
            className="grid gap-3 sm:flex sm:flex-wrap sm:items-end"
          >
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-xs">
              <Label htmlFor="tank-levels-day">Date</Label>
              <Input
                id="tank-levels-day"
                name="date"
                type="date"
                defaultValue={day}
                className="h-11 w-full text-base"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="min-h-11 w-full sm:w-auto"
            >
              Show day
            </Button>
          </Form>
        </CardHeader>
      </Card>

      <Form method="post" {...getFormProps(form)} className="grid gap-4">
        <input type="hidden" name="day" value={day} />

        {!canEdit ? (
          <Alert>
            <AlertTitle>Read only</AlertTitle>
            <AlertDescription>
              Only admins can change levels for previous days. Switch to today
              to log or edit.
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

        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>
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
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid list-none gap-3 p-0">
            {rows.map((row) => {
              const warn =
                warnings[row.id] ??
                (row.levelKg != null
                  ? overCapacityWarning(row.levelKg, row.capacityKg)
                  : null);
              const inputName = tankLevelFieldName(row.id);
              const inputId = `level-${row.id}`;
              const hasLevel = row.levelKg != null;

              return (
                <li key={row.id}>
                  <div
                    className={cn(
                      "rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
                      hasLevel
                        ? "border-l-4 border-l-brand"
                        : "border-l-4 border-l-transparent",
                      warn && "border-amber-400/80",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-heading text-lg font-semibold tracking-tight text-brand-navy">
                        {row.code}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        Cap{" "}
                        <span className="font-medium text-foreground">
                          {row.capacityKg.toLocaleString("en-AU")}
                        </span>{" "}
                        kg
                      </p>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {row.product}
                    </p>
                    <div className="grid gap-1.5">
                      <Label
                        htmlFor={inputId}
                        className="text-sm font-medium text-foreground"
                      >
                        Level (kg)
                      </Label>
                      <Input
                        id={inputId}
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
                          "h-12 w-full text-lg tabular-nums",
                          warn && "border-amber-500",
                        )}
                        aria-label={`${row.code} level kg`}
                        aria-describedby={
                          warn ? `warn-${row.id}` : undefined
                        }
                      />
                      {warn ? (
                        <p
                          id={`warn-${row.id}`}
                          className="text-sm text-amber-700 dark:text-amber-400"
                        >
                          {warn}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && rows.length > 0 ? (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="min-h-12 w-full text-base sm:ml-auto sm:w-auto sm:min-w-44"
            >
              {isSubmitting ? "Saving…" : "Save levels"}
            </Button>
          </div>
        ) : null}
      </Form>
    </div>
  );
}
