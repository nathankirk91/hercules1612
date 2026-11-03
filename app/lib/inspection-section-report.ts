import {
  buildAnswersFromResponses,
  type InspectionAnswerRecord,
  type InspectionDefinition,
} from "./inspections.ts";

export type InspectionSectionReportView = {
  sectionTitle: string;
  answers: InspectionAnswerRecord[];
  notes: string | null;
  signature: string | null;
  completedByName: string | null;
  completedAt: Date | string | null;
};

type SectionResponsesPayload = {
  answers: Record<string, string>;
  notes: string | null;
};

function isSectionResponsesPayload(
  value: unknown,
): value is { answers: unknown; notes?: unknown } {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "answers" in value &&
      (value as { answers: unknown }).answers != null &&
      typeof (value as { answers: unknown }).answers === "object",
  );
}

/** Pack question answers + optional notes for storage on a section completion. */
export function packSectionResponses(args: {
  answers: Record<string, string>;
  notes?: string | null;
}): SectionResponsesPayload {
  const notes = String(args.notes ?? "").trim() || null;
  return {
    answers: args.answers,
    notes,
  };
}

/** Read optional notes saved with a section completion payload. */
export function parseSectionStoredNotes(value: unknown): string | null {
  if (!isSectionResponsesPayload(value)) {
    return null;
  }
  const notes = String(value.notes ?? "").trim();
  return notes || null;
}

/** Normalize stored section responses (map, answer-record array, or packed payload). */
export function parseSectionResponseMap(value: unknown): Record<string, string> {
  if (value == null) {
    return {};
  }
  const source = isSectionResponsesPayload(value) ? value.answers : value;
  if (Array.isArray(source)) {
    const map: Record<string, string> = {};
    for (const item of source) {
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
  if (typeof source !== "object" || source == null) {
    return {};
  }
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source as Record<string, unknown>)) {
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
  /** Fallback when older completions only stored notes on the run. */
  notesFallback?: string | null;
  signature?: string | null;
  completedByName?: string | null;
  completedAt?: Date | string | null;
}): InspectionSectionReportView {
  const responses = parseSectionResponseMap(args.responses);
  const answers = buildAnswersFromResponses(args.sectionDefinition, responses);
  // Packed payloads carry per-section notes; legacy flat maps fall back to run notes.
  const notes = isSectionResponsesPayload(args.responses)
    ? parseSectionStoredNotes(args.responses)
    : String(args.notesFallback ?? "").trim() || null;
  return {
    sectionTitle: args.sectionTitle,
    answers,
    notes,
    signature: args.signature?.trim() || null,
    completedByName: args.completedByName?.trim() || null,
    completedAt: args.completedAt ?? null,
  };
}
