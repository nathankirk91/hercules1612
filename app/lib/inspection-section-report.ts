import {
  buildAnswersFromResponses,
  type InspectionAnswerRecord,
  type InspectionDefinition,
} from "./inspections.ts";

export type InspectionSectionReportView = {
  sectionTitle: string;
  answers: InspectionAnswerRecord[];
  signature: string | null;
  completedByName: string | null;
  completedAt: Date | string | null;
};

/** Normalize stored section responses (map or answer-record array) to a string map. */
export function parseSectionResponseMap(value: unknown): Record<string, string> {
  if (value == null) {
    return {};
  }
  if (Array.isArray(value)) {
    const map: Record<string, string> = {};
    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as { questionId?: unknown; answer?: unknown };
      const questionId = String(row.questionId ?? "").trim();
      if (!questionId) {
        continue;
      }
      map[questionId] = String(row.answer ?? "");
    }
    return map;
  }
  if (typeof value !== "object") {
    return {};
  }
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    map[key] = String(entry ?? "");
  }
  return map;
}

/**
 * Build a read-only section report from a section-scoped definition and saved
 * responses. Used when operators open a completed section.
 */
export function buildInspectionSectionReport(args: {
  sectionTitle: string;
  sectionDefinition: InspectionDefinition;
  responses: unknown;
  signature?: string | null;
  completedByName?: string | null;
  completedAt?: Date | string | null;
}): InspectionSectionReportView {
  const responses = parseSectionResponseMap(args.responses);
  const answers = buildAnswersFromResponses(args.sectionDefinition, responses);
  return {
    sectionTitle: args.sectionTitle,
    answers,
    signature: args.signature?.trim() || null,
    completedByName: args.completedByName?.trim() || null,
    completedAt: args.completedAt ?? null,
  };
}
