import {
  INSPECTION_SHIFT_OPTIONS,
  resolveInspectionSections,
  type InspectionDefinition,
  type InspectionQuestionDef,
  type InspectionSectionDef,
} from "./inspections.ts";

export const INSPECTION_WORKFLOW_MODES = ["SINGLE_SUBMIT", "SECTIONED"] as const;
export type InspectionWorkflowMode = (typeof INSPECTION_WORKFLOW_MODES)[number];

export const INSPECTION_DAY_RECORD_POLICIES = ["ONE", "PER_SHIFT"] as const;
export type InspectionDayRecordPolicy =
  (typeof INSPECTION_DAY_RECORD_POLICIES)[number];

export const INSPECTION_SECTION_ORDERS = ["ANY", "STRICT"] as const;
export type InspectionSectionOrder = (typeof INSPECTION_SECTION_ORDERS)[number];

export type InspectionRunStatus =
  | "IN_PROGRESS"
  | "PASSED"
  | "NEEDS_ATTENTION"
  | "VOIDED";

export type SectionProgressStatus =
  | "locked"
  | "available"
  | "complete"
  | "skipped";

export type SectionCompletion = {
  sectionId: string;
  status: "COMPLETE" | "SKIPPED";
  completedByName?: string | null;
  completedAt?: Date | string | null;
};

export type SectionProgressItem = {
  section: InspectionSectionDef;
  status: SectionProgressStatus;
  completedByName: string | null;
  completedAt: Date | string | null;
};

export type RecordSlot = {
  shift: string | null;
  label: string;
  openLabel: string;
};

export function parseWorkflowMode(value: unknown): InspectionWorkflowMode {
  return value === "SECTIONED" ? "SECTIONED" : "SINGLE_SUBMIT";
}

export function parseDayRecordPolicy(
  value: unknown,
): InspectionDayRecordPolicy {
  return value === "PER_SHIFT" ? "PER_SHIFT" : "ONE";
}

export function parseSectionOrder(value: unknown): InspectionSectionOrder {
  return value === "STRICT" ? "STRICT" : "ANY";
}

export function parseInspectionShift(
  value: unknown,
): (typeof INSPECTION_SHIFT_OPTIONS)[number] | null {
  const trimmed = String(value ?? "").trim();
  return INSPECTION_SHIFT_OPTIONS.find((shift) => shift === trimmed) ?? null;
}

export function isSectionedWorkflow(
  definition: Pick<InspectionDefinition, "workflowMode">,
): boolean {
  return parseWorkflowMode(definition.workflowMode) === "SECTIONED";
}

export function recordSlotsForPolicy(
  policy: InspectionDayRecordPolicy,
): RecordSlot[] {
  if (policy === "PER_SHIFT") {
    return INSPECTION_SHIFT_OPTIONS.map((shift) => ({
      shift,
      label: `${shift} record`,
      openLabel: `Open ${shift} record`,
    }));
  }
  return [
    {
      shift: null,
      label: "Record",
      openLabel: "Open record",
    },
  ];
}

export function recordLabel(shift: string | null | undefined): string {
  const parsed = parseInspectionShift(shift);
  return parsed ? `${parsed} record` : "Record";
}

export function sectionIsSkippedByAnswers(
  section: InspectionSectionDef,
  responses: Record<string, string>,
): boolean {
  const questionId = section.skipWhenQuestionId?.trim();
  if (!questionId) {
    return false;
  }
  const expected = String(section.skipWhenEquals ?? "").trim();
  if (!expected) {
    return false;
  }
  const actual = String(responses[questionId] ?? "").trim();
  return actual === expected;
}

export function evaluateSectionProgress(args: {
  sections: InspectionSectionDef[];
  completions: SectionCompletion[];
  responses: Record<string, string>;
  sectionOrder: InspectionSectionOrder;
}): SectionProgressItem[] {
  const completionBySection = new Map(
    args.completions.map((row) => [row.sectionId, row]),
  );
  const items: SectionProgressItem[] = [];
  let previousBlockingOpen = false;

  for (const section of args.sections) {
    const existing = completionBySection.get(section.id);
    let status: SectionProgressStatus;

    if (existing?.status === "COMPLETE") {
      status = "complete";
    } else if (
      existing?.status === "SKIPPED" ||
      sectionIsSkippedByAnswers(section, args.responses)
    ) {
      status = "skipped";
    } else if (
      args.sectionOrder === "STRICT" &&
      previousBlockingOpen
    ) {
      status = "locked";
    } else {
      status = "available";
    }

    items.push({
      section,
      status,
      completedByName: existing?.completedByName ?? null,
      completedAt: existing?.completedAt ?? null,
    });

    if (status === "available" || status === "locked") {
      previousBlockingOpen = true;
    }
  }

  return items;
}

export function requiredSectionsRemaining(
  progress: SectionProgressItem[],
): number {
  return progress.filter(
    (item) => item.status === "available" || item.status === "locked",
  ).length;
}

export function recordCanAutoComplete(progress: SectionProgressItem[]): boolean {
  return requiredSectionsRemaining(progress) === 0 && progress.length > 0;
}

export function definitionForSection(
  definition: InspectionDefinition,
  sectionId: string,
): InspectionDefinition {
  const questions = definition.questions.filter(
    (question) => (question.sectionId?.trim() || "") === sectionId,
  );
  const sections = resolveInspectionSections(definition).filter(
    (section) => section.id === sectionId,
  );
  return {
    ...definition,
    questions,
    sections,
  };
}

export function mergeResponseMaps(
  ...maps: Array<Record<string, string> | null | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const [key, value] of Object.entries(map)) {
      merged[key] = String(value ?? "");
    }
  }
  return merged;
}

export function sectionsNeedingSkip(args: {
  sections: InspectionSectionDef[];
  completions: SectionCompletion[];
  responses: Record<string, string>;
}): InspectionSectionDef[] {
  const done = new Set(args.completions.map((row) => row.sectionId));
  return args.sections.filter(
    (section) =>
      !done.has(section.id) &&
      sectionIsSkippedByAnswers(section, args.responses),
  );
}

export function workflowSettingsFromSource(source: {
  workflowMode?: unknown;
  dayRecordPolicy?: unknown;
  sectionOrder?: unknown;
}): {
  workflowMode: InspectionWorkflowMode;
  dayRecordPolicy: InspectionDayRecordPolicy;
  sectionOrder: InspectionSectionOrder;
} {
  return {
    workflowMode: parseWorkflowMode(source.workflowMode),
    dayRecordPolicy: parseDayRecordPolicy(source.dayRecordPolicy),
    sectionOrder: parseSectionOrder(source.sectionOrder),
  };
}

export function questionsForSkipPicker(
  questions: InspectionQuestionDef[],
  sectionId: string,
): InspectionQuestionDef[] {
  return questions.filter(
    (question) => (question.sectionId?.trim() || "") !== sectionId,
  );
}
