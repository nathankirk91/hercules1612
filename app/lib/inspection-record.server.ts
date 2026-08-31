import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "~/lib/db.server";
import { melbourneDateYmd } from "~/lib/datetime";
import { createInspectionSchema } from "~/lib/inspection.schema";
import {
  answersToResponseMap,
  buildAnswersFromResponses,
  findShiftQuestion,
  resolveInspectionSections,
  summarizeInspectionAnswers,
  type InspectionAnswerRecord,
  type InspectionDefinition,
  type InspectionSummary,
} from "~/lib/inspections";
import {
  definitionForSection,
  evaluateSectionProgress,
  isSectionedWorkflow,
  mergeResponseMaps,
  parseDayRecordPolicy,
  parseInspectionShift,
  parseSectionOrder,
  parseWorkflowMode,
  recordCanAutoComplete,
  recordSlotsForPolicy,
  sectionsNeedingSkip,
  type SectionCompletion,
  type SectionProgressItem,
} from "~/lib/inspection-workflow";
import { createInspectionActions } from "~/lib/inspections.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import { getActiveOperatorById } from "~/lib/operators.server";

export type InspectionRecordSlotView = {
  shift: string | null;
  label: string;
  openLabel: string;
  runId: string | null;
  status: "not_started" | "IN_PROGRESS" | "PASSED" | "NEEDS_ATTENTION";
  remaining: number;
  total: number;
};

export type InspectionRecordDetail = {
  id: string;
  inspectionId: string;
  status: "IN_PROGRESS" | "PASSED" | "NEEDS_ATTENTION" | "VOIDED";
  recordDate: string;
  shift: string | null;
  equipmentRef: string | null;
  notes: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  startedByName: string | null;
  progress: SectionProgressItem[];
  remaining: number;
  total: number;
};

function emptySummary(): InspectionSummary {
  return {
    answeredCount: 0,
    attentionCount: 0,
    status: "PASSED",
    attentionItems: [],
  };
}

function sectionedSections(definition: InspectionDefinition) {
  return resolveInspectionSections(definition).filter((section) =>
    definition.questions.some(
      (question) => (question.sectionId?.trim() || "") === section.id,
    ),
  );
}

export async function listRecordsForDay(args: {
  definition: InspectionDefinition;
  recordDate?: string;
  equipmentRef: string | null;
}): Promise<InspectionRecordSlotView[]> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  const recordDate = args.recordDate || melbourneDateYmd();
  const policy = parseDayRecordPolicy(args.definition.dayRecordPolicy);
  const slots = recordSlotsForPolicy(policy);
  const sections = sectionedSections(args.definition);

  if (!prisma) {
    return slots.map((slot) => ({
      ...slot,
      runId: null,
      status: "not_started",
      remaining: sections.length,
      total: sections.length,
    }));
  }

  const rows = await prisma.inspectionRun.findMany({
    where: {
      inspectionId: args.definition.id,
      recordDate,
      equipmentRef: args.equipmentRef,
      status: { not: "VOIDED" },
    },
    include: {
      sectionCompletions: {
        select: { sectionId: true, status: true },
      },
    },
  });

  return slots.map((slot) => {
    const row = rows.find(
      (item) => (item.shift ?? null) === (slot.shift ?? null),
    );
    if (!row) {
      return {
        ...slot,
        runId: null,
        status: "not_started" as const,
        remaining: sections.length,
        total: sections.length,
      };
    }
    const responses = answersToResponseMap(
      Array.isArray(row.responses) ? (row.responses as InspectionAnswerRecord[]) : [],
    );
    const progress = evaluateSectionProgress({
      sections,
      completions: row.sectionCompletions.map((item) => ({
        sectionId: item.sectionId,
        status: item.status,
      })),
      responses,
      sectionOrder: parseSectionOrder(args.definition.sectionOrder),
    });
    const remaining = progress.filter(
      (item) => item.status === "available" || item.status === "locked",
    ).length;
    return {
      ...slot,
      runId: row.id,
      status:
        row.status === "IN_PROGRESS" ||
        row.status === "PASSED" ||
        row.status === "NEEDS_ATTENTION"
          ? row.status
          : "IN_PROGRESS",
      remaining,
      total: progress.length,
    };
  });
}

export async function openInspectionRecord(args: {
  definition: InspectionDefinition;
  userId: string;
  equipmentRef: string | null;
  shift: string | null;
  recordDate?: string;
}): Promise<{ id: string }> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  if (!isSectionedWorkflow(args.definition)) {
    throw new Error("This inspection uses a single submit, not records.");
  }

  const sections = sectionedSections(args.definition);
  if (sections.length === 0) {
    throw new Error(
      "Add sections in Manage before opening a record for this inspection.",
    );
  }

  const policy = parseDayRecordPolicy(args.definition.dayRecordPolicy);
  const recordDate = args.recordDate || melbourneDateYmd();
  let shift: string | null = null;
  if (policy === "PER_SHIFT") {
    shift = parseInspectionShift(args.shift);
    if (!shift) {
      throw new Error("Select Day or Afternoon.");
    }
  }

  const equipmentRef =
    args.definition.fixedEquipmentRef?.trim() ||
    args.equipmentRef?.trim() ||
    null;
  if (args.definition.equipmentLabel && !equipmentRef) {
    throw new Error(
      `${args.definition.equipmentLabel} is required to open a record.`,
    );
  }

  const existing = await prisma.inspectionRun.findFirst({
    where: {
      inspectionId: args.definition.id,
      recordDate,
      equipmentRef,
      shift,
      status: { not: "VOIDED" },
    },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id };
  }

  try {
    const row = await prisma.inspectionRun.create({
      data: {
        inspectionId: args.definition.id,
        submittedById: args.userId,
        startedById: args.userId,
        status: "IN_PROGRESS",
        equipmentRef,
        recordDate,
        shift,
        responses: [] as unknown as Prisma.InputJsonValue,
        summary: emptySummary() as unknown as Prisma.InputJsonValue,
        sectionSignatures: {},
      },
      select: { id: true },
    });
    return { id: row.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.inspectionRun.findFirst({
        where: {
          inspectionId: args.definition.id,
          recordDate,
          equipmentRef,
          shift,
          status: { not: "VOIDED" },
        },
        select: { id: true },
      });
      if (raced) {
        return { id: raced.id };
      }
    }
    throw error;
  }
}

export async function getInspectionRecordDetail(args: {
  runId: string;
  definition: InspectionDefinition;
}): Promise<InspectionRecordDetail | null> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const row = await prisma.inspectionRun.findUnique({
    where: { id: args.runId },
    include: {
      startedBy: { select: { name: true, email: true } },
      sectionCompletions: {
        include: {
          completedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!row || row.inspectionId !== args.definition.id) {
    return null;
  }

  const sections = sectionedSections(args.definition);
  const responses = answersToResponseMap(
    Array.isArray(row.responses)
      ? (row.responses as InspectionAnswerRecord[])
      : [],
  );
  const completions: SectionCompletion[] = row.sectionCompletions.map(
    (item) => ({
      sectionId: item.sectionId,
      status: item.status,
      completedByName:
        item.completedBy?.name?.trim() || item.completedBy?.email || null,
      completedAt: item.completedAt,
    }),
  );
  const progress = evaluateSectionProgress({
    sections,
    completions,
    responses,
    sectionOrder: parseSectionOrder(args.definition.sectionOrder),
  });

  return {
    id: row.id,
    inspectionId: row.inspectionId,
    status: row.status,
    recordDate: row.recordDate ?? "",
    shift: row.shift,
    equipmentRef: row.equipmentRef,
    notes: row.notes,
    voidReason: row.voidReason,
    voidedAt: row.voidedAt,
    startedByName:
      row.startedBy?.name?.trim() || row.startedBy?.email || null,
    progress,
    remaining: progress.filter(
      (item) => item.status === "available" || item.status === "locked",
    ).length,
    total: progress.length,
  };
}

export async function completeInspectionSection(args: {
  definition: InspectionDefinition;
  runId: string;
  sectionId: string;
  userId: string;
  operatorId: string;
  responses: Record<string, string>;
  signature: string | null;
  notes: string | null;
  actions: string[];
  isFirstInspectionOfWeek: boolean;
}): Promise<{
  remaining: number;
  completed: boolean;
  status: InspectionSummary["status"] | "IN_PROGRESS";
}> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const operator = await getActiveOperatorById(args.operatorId);
  if (!operator) {
    throw new Error("Select a valid operator.");
  }

  const run = await prisma.inspectionRun.findUnique({
    where: { id: args.runId },
    include: { sectionCompletions: true },
  });
  if (!run || run.inspectionId !== args.definition.id) {
    throw new Error("Record not found.");
  }
  if (run.status !== "IN_PROGRESS") {
    throw new Error("This record can no longer accept section updates.");
  }

  const existing = run.sectionCompletions.find(
    (row) => row.sectionId === args.sectionId,
  );
  if (existing?.status === "COMPLETE") {
    throw new Error("This section was already completed.");
  }

  const sections = sectionedSections(args.definition);
  const mergedBefore = mergeResponseMaps(
    answersToResponseMap(
      Array.isArray(run.responses)
        ? (run.responses as InspectionAnswerRecord[])
        : [],
    ),
    args.responses,
  );
  const progress = evaluateSectionProgress({
    sections,
    completions: run.sectionCompletions.map((row) => ({
      sectionId: row.sectionId,
      status: row.status,
    })),
    responses: mergedBefore,
    sectionOrder: parseSectionOrder(args.definition.sectionOrder),
  });
  const current = progress.find((item) => item.section.id === args.sectionId);
  if (!current) {
    throw new Error("Section not found on this inspection.");
  }
  if (current.status === "locked") {
    throw new Error("Complete the previous section first.");
  }
  if (current.status === "skipped") {
    throw new Error("This section is not required.");
  }

  const sectionDef = definitionForSection(args.definition, args.sectionId);
  const shiftQuestion = findShiftQuestion(args.definition.questions);
  if (run.shift && shiftQuestion) {
    args.responses[shiftQuestion.id] = run.shift;
  }
  const schema = createInspectionSchema(sectionDef, {
    isFirstInspectionOfWeek: args.isFirstInspectionOfWeek,
  });
  const parsed = schema.safeParse({
    operatorId: args.operatorId,
    equipmentRef: run.equipmentRef ?? "",
    notes: args.notes ?? "",
    actions: args.actions,
    sectionSignatures: args.signature
      ? { [args.sectionId]: args.signature }
      : {},
    responses: args.responses,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.message || "Check the section answers.");
  }

  const now = new Date();
  const mergedResponses = mergeResponseMaps(
    answersToResponseMap(
      Array.isArray(run.responses)
        ? (run.responses as InspectionAnswerRecord[])
        : [],
    ),
    parsed.data.responses,
  );
  const sectionSignatures = {
    ...((run.sectionSignatures as Record<string, string> | null) ?? {}),
    ...parsed.data.sectionSignatures,
  };
  const answers = buildAnswersFromResponses(
    { ...args.definition, questions: args.definition.questions },
    mergedResponses,
  );
  const notes = [run.notes, parsed.data.notes]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("\n");

  await prisma.$transaction(async (tx) => {
    try {
      await tx.inspectionRunSection.create({
        data: {
          runId: args.runId,
          sectionId: args.sectionId,
          status: "COMPLETE",
          responses: parsed.data.responses as unknown as Prisma.InputJsonValue,
          signature: args.signature,
          operatorUserId: operator.id,
          completedById: args.userId,
          completedAt: now,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("This section was already completed.");
      }
      throw error;
    }

    const skipTargets = sectionsNeedingSkip({
      sections,
      completions: [
        ...run.sectionCompletions.map((row) => ({
          sectionId: row.sectionId,
          status: row.status,
        })),
        { sectionId: args.sectionId, status: "COMPLETE" },
      ],
      responses: mergedResponses,
    });
    for (const section of skipTargets) {
      await tx.inspectionRunSection.upsert({
        where: {
          runId_sectionId: { runId: args.runId, sectionId: section.id },
        },
        create: {
          runId: args.runId,
          sectionId: section.id,
          status: "SKIPPED",
          responses: {} as Prisma.InputJsonValue,
          completedById: args.userId,
          completedAt: now,
        },
        update: {
          status: "SKIPPED",
          completedAt: now,
        },
      });
    }

    const nextCompletions = [
      ...run.sectionCompletions.map((row) => ({
        sectionId: row.sectionId,
        status: row.status,
      })),
      { sectionId: args.sectionId, status: "COMPLETE" as const },
      ...skipTargets.map((section) => ({
        sectionId: section.id,
        status: "SKIPPED" as const,
      })),
    ];
    const nextProgress = evaluateSectionProgress({
      sections,
      completions: nextCompletions,
      responses: mergedResponses,
      sectionOrder: parseSectionOrder(args.definition.sectionOrder),
    });
    const done = recordCanAutoComplete(nextProgress);
    const summary = summarizeInspectionAnswers(answers);

    await tx.inspectionRun.update({
      where: { id: args.runId },
      data: {
        operatorUserId: operator.id,
        responses: answers as unknown as Prisma.InputJsonValue,
        sectionSignatures: sectionSignatures as unknown as Prisma.InputJsonValue,
        notes: notes || null,
        signature: parsed.data.signature || run.signature,
        summary: summary as unknown as Prisma.InputJsonValue,
        ...(done
          ? { status: summary.status }
          : { status: "IN_PROGRESS" }),
      },
    });
  });

  if (parsed.data.actions.length > 0) {
    await createInspectionActions({
      createdOnRunId: args.runId,
      inspectionId: args.definition.id,
      equipmentRef: run.equipmentRef,
      descriptions: parsed.data.actions,
      createdByUserId: args.userId,
    });
  }

  const refreshed = await prisma.inspectionRunSection.findMany({
    where: { runId: args.runId },
    select: { sectionId: true, status: true },
  });
  const nextProgress = evaluateSectionProgress({
    sections,
    completions: refreshed,
    responses: mergedResponses,
    sectionOrder: parseSectionOrder(args.definition.sectionOrder),
  });
  const remaining = nextProgress.filter(
    (item) => item.status === "available" || item.status === "locked",
  ).length;
  const completed = remaining === 0;
  const summary = summarizeInspectionAnswers(answers);

  return {
    remaining,
    completed,
    status: completed ? summary.status : "IN_PROGRESS",
  };
}

export async function voidInspectionRecord(args: {
  runId: string;
  userId: string;
  reason: string;
}): Promise<void> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const reason = args.reason.trim();
  if (!reason) {
    throw new Error("A void reason is required.");
  }

  const run = await prisma.inspectionRun.findUnique({
    where: { id: args.runId },
    select: { id: true, status: true },
  });
  if (!run) {
    throw new Error("Record not found.");
  }
  if (run.status !== "IN_PROGRESS") {
    throw new Error("Only in-progress records can be voided.");
  }

  await prisma.inspectionRun.update({
    where: { id: args.runId },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidedById: args.userId,
      voidReason: reason,
    },
  });
}

export function assertSectionedDefinition(definition: InspectionDefinition) {
  if (parseWorkflowMode(definition.workflowMode) !== "SECTIONED") {
    throw new Error("This inspection is not set up for records.");
  }
}

export { emptySummary };
