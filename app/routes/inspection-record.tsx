import { Form, Link, redirect } from "react-router";

import type { Route } from "./+types/inspection-record";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime, formatMelbourneYmd } from "~/lib/datetime";
import {
  getInspectionRecordDetail,
  voidInspectionRecord,
} from "~/lib/inspection-record.server";
import {
  recordLabel,
  sortSectionProgressForDisplay,
} from "~/lib/inspection-workflow";
import { isPermitInspection } from "~/lib/inspections";
import { getInspectionDefinition } from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Inspection record") },
    {
      name: "description",
      content: "Section progress for this inspection record.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable || isPermitInspection(definition)) {
    throw new Response("Inspection not found", { status: 404 });
  }
  const user = await requireUser(
    request,
    `/inspections/${params.inspectionId}/records/${params.runId}`,
  );
  const record = await getInspectionRecordDetail({
    runId: params.runId,
    definition,
  });
  if (!record) {
    throw new Response("Record not found", { status: 404 });
  }
  if (record.status === "VOIDED") {
    throw redirect(definition.href);
  }
  if (record.status === "PASSED" || record.status === "NEEDS_ATTENTION") {
    throw redirect(`/inspections/submissions/${record.id}`);
  }

  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  return {
    user,
    definition,
    record,
    pendingCount,
    canVoid: canReviewRuns(user.role),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }
  const user = await requireUser(
    request,
    `/inspections/${params.inspectionId}/records/${params.runId}`,
  );
  if (!canReviewRuns(user.role)) {
    return { error: "Only approvers and admins can void a record." };
  }
  const formData = await request.formData();
  if (String(formData.get("intent") ?? "") !== "void-record") {
    return { error: "Unknown action." };
  }
  try {
    await voidInspectionRecord({
      runId: params.runId,
      userId: user.id,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not void this record.",
    };
  }
  throw redirect(definition.href);
}

export default function InspectionRecordPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { definition, record, user, pendingCount, canVoid } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{definition.category}</Badge>
            <Link
              to={definition.href}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← {definition.title}
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {recordLabel(record.shift)}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {formatMelbourneYmd(record.recordDate) ?? record.recordDate}
            {record.equipmentRef ? ` · ${record.equipmentRef}` : ""}
            {record.startedByName ? ` · opened by ${record.startedByName}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {record.total - record.remaining} of {record.total} sections
            complete
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>
              Complete an available section. Finished sections stay as they
              were saved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {sortSectionProgressForDisplay(record.progress).map((item) => (
                <li
                  key={item.section.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-brand-navy">
                      {item.section.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.status === "complete"
                        ? item.completedByName
                          ? `Completed by ${item.completedByName}${
                              item.completedAt
                                ? ` · ${formatMelbourneDateTime(item.completedAt)}`
                                : ""
                            }`
                          : "Completed"
                        : item.status === "skipped"
                          ? "Skipped — not required"
                          : item.status === "locked"
                            ? "Locked until the previous section is done"
                            : "Available"}
                    </p>
                  </div>
                  {item.status === "available" ? (
                    <Button asChild size="sm">
                      <Link to={`sections/${item.section.id}`}>
                        Open section
                      </Link>
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        item.status === "complete" &&
                          "border-emerald-600/40 text-emerald-700",
                        item.status === "skipped" &&
                          "border-muted-foreground/40",
                      )}
                    >
                      {item.status === "complete"
                        ? "Done"
                        : item.status === "skipped"
                          ? "Skipped"
                          : item.status === "locked"
                            ? "Locked"
                            : "Open"}
                    </Badge>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {canVoid ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Void record</CardTitle>
              <CardDescription>
                Approvers and admins can void an in-progress record. The
                reason is kept for audit. Operators can then open a new
                record for this slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionData && "error" in actionData && actionData.error ? (
                <p className="mb-3 text-sm text-destructive">
                  {actionData.error}
                </p>
              ) : null}
              <Form method="post" className="grid gap-3">
                <input type="hidden" name="intent" value="void-record" />
                <div className="grid gap-2">
                  <Label htmlFor="void-reason">Reason</Label>
                  <Textarea
                    id="void-reason"
                    name="reason"
                    required
                    rows={2}
                    placeholder="Why this record should not count…"
                  />
                </div>
                <div>
                  <Button type="submit" variant="outline">
                    Void record
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
