import { Link, data, redirect } from "react-router";

import type { Route } from "./+types/inspection-record-section";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { InspectionChecklistForm } from "~/components/inspection-checklist-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { completeInspectionSection } from "~/lib/inspection-record.server";
import { getInspectionRecordDetail } from "~/lib/inspection-record.server";
import {
  definitionForSection,
  recordLabel,
} from "~/lib/inspection-workflow";
import { isPermitInspection } from "~/lib/inspections";
import {
  getInspectionDefinition,
  getLastAnswersForInspection,
  isFirstInspectionOfWeek,
  listOpenInspectionActions,
} from "~/lib/inspections.server";
import { listActiveOperators } from "~/lib/operators.server";
import { canReviewRuns } from "~/lib/roles";
import { createInspectionSchema } from "~/lib/inspection.schema";
import { parseWithZod } from "@conform-to/zod/v4";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Inspection section") },
    {
      name: "description",
      content: "Complete one section of this inspection record.",
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
    `/inspections/${params.inspectionId}/records/${params.runId}/sections/${params.sectionId}`,
  );
  const record = await getInspectionRecordDetail({
    runId: params.runId,
    definition,
  });
  if (!record) {
    throw new Response("Record not found", { status: 404 });
  }
  const item = record.progress.find(
    (row) => row.section.id === params.sectionId,
  );
  if (!item) {
    throw new Response("Section not found", { status: 404 });
  }
  if (item.status !== "available") {
    throw redirect(
      `/inspections/${params.inspectionId}/records/${params.runId}`,
    );
  }

  const sectionDefinition = definitionForSection(definition, params.sectionId);
  const equipmentRef = record.equipmentRef;
  const [operators, pendingCount, lastAnswersResult, openActions, firstOfWeek] =
    await Promise.all([
      listActiveOperators(),
      canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
      getLastAnswersForInspection({
        inspectionId: definition.id,
        equipmentRef,
      }),
      listOpenInspectionActions({
        inspectionId: definition.id,
        equipmentRef,
      }),
      sectionDefinition.questions.some((question) => question.firstOfWeekOnly)
        ? isFirstInspectionOfWeek({
            inspectionId: definition.id,
            equipmentRef,
            shift: record.shift,
          })
        : Promise.resolve(true),
    ]);

  return {
    user,
    definition,
    sectionDefinition,
    record,
    sectionTitle: item.section.title,
    operators,
    pendingCount,
    equipmentRef,
    isFirstInspectionOfWeek: firstOfWeek,
    lastAnswers: lastAnswersResult.answers,
    lastRunAt: lastAnswersResult.createdAt,
    openActions,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }
  const user = await requireUser(
    request,
    `/inspections/${params.inspectionId}/records/${params.runId}/sections/${params.sectionId}`,
  );

  const formData = await request.formData();
  const responseMap: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^responses\[(.+)\]$/.exec(key);
    if (match) {
      responseMap[match[1]] = String(value);
    }
  }
  const signatureKeys = [...formData.keys()].filter((key) =>
    key.startsWith("sectionSignatures["),
  );
  let signature: string | null = null;
  for (const key of signatureKeys) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) {
      signature = value;
    }
  }

  const sectionDefinition = definitionForSection(definition, params.sectionId);
  const schema = createInspectionSchema(sectionDefinition, {
    isFirstInspectionOfWeek: true,
  });
  const submission = parseWithZod(formData, { schema });
  if (submission.status !== "success") {
    return data(
      { lastResult: submission.reply(), formError: null },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  try {
    const result = await completeInspectionSection({
      definition,
      runId: params.runId,
      sectionId: params.sectionId,
      userId: user.id,
      operatorId: submission.value.operatorId,
      responses: submission.value.responses,
      signature,
      notes: submission.value.notes,
      actions: submission.value.actions,
      isFirstInspectionOfWeek: true,
    });
    if (result.completed) {
      throw redirect(`/inspections/submissions/${params.runId}`);
    }
    throw redirect(
      `/inspections/${params.inspectionId}/records/${params.runId}`,
    );
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return data(
      {
        lastResult: submission.reply(),
        formError:
          error instanceof Error
            ? error.message
            : "Could not save this section.",
      },
      { status: 400 },
    );
  }
}

export default function InspectionRecordSectionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    definition,
    sectionDefinition,
    record,
    sectionTitle,
    user,
    operators,
    pendingCount,
    equipmentRef,
    isFirstInspectionOfWeek,
    lastAnswers,
    lastRunAt,
    openActions,
  } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{sectionTitle}</Badge>
            <Link
              to={`/inspections/${definition.slug}/records/${record.id}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← {recordLabel(record.shift)}
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {sectionTitle}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {definition.title}. First save wins — this section cannot be
            jointly edited.
          </p>
        </div>
        <InspectionChecklistForm
          definition={sectionDefinition}
          operators={operators}
          selectedShift={record.shift}
          equipmentRef={equipmentRef}
          isFirstInspectionOfWeek={isFirstInspectionOfWeek}
          lastAnswers={lastAnswers}
          lastRunAt={lastRunAt}
          openActions={openActions}
          lastResult={actionData?.lastResult}
          formError={actionData?.formError}
          submitLabel="Save section"
          hideResultCard
        />
      </main>
    </div>
  );
}
