import type { InspectionAnswerRecord } from "~/lib/inspections";

type PermitRunStatus = "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";

export const PENDING_AUTHORIZATION_LABEL = "Pending authorization";
export const PENDING_AUTHORIZED_PERSONNEL_LABEL =
  "Pending authorized personnel";

export type PermitStatusBadgeKind =
  | "archived"
  | "pending-authorization"
  | "pending-authorized-personnel"
  | "open"
  | "closed";

export type PermitStatusBadge = {
  kind: PermitStatusBadgeKind;
  label: string;
  className: string;
};

export function workDescriptionFromAnswers(
  answers: InspectionAnswerRecord[],
): string | null {
  const row = answers.find(
    (answer) =>
      answer.questionId.endsWith("__work-to-be-performed") ||
      answer.label.trim().toLowerCase() === "work to be performed",
  );
  const value = row?.answer?.trim();
  return value || null;
}

export function permitRecordHeading(args: {
  workDescription: string | null;
  equipmentRef: string | null;
  permitNumber: string | null;
}): string {
  if (args.workDescription) {
    return args.workDescription;
  }
  if (args.equipmentRef?.trim()) {
    return args.equipmentRef.trim();
  }
  if (args.permitNumber?.trim()) {
    return `#${args.permitNumber.trim()}`;
  }
  return "Permit";
}

export function permitStatusLabel(status: PermitRunStatus): string {
  if (status === "PENDING_AUTHORIZATION") {
    return PENDING_AUTHORIZATION_LABEL;
  }
  if (status === "OPEN") {
    return "Open";
  }
  return "Closed";
}

/** True when the permit still needs at least one authorized person recorded. */
export function needsAuthorizedPersonnel(
  authorizedPersonnelCount: number,
): boolean {
  return authorizedPersonnelCount < 1;
}

/**
 * Status badges for dashboard/history cards.
 * Active permits can show both authorization and authorized-personnel pending.
 */
export function permitStatusBadges(args: {
  status: PermitRunStatus;
  authorizedPersonnelCount: number;
  archivedAt?: Date | string | null;
}): PermitStatusBadge[] {
  if (args.archivedAt) {
    return [
      {
        kind: "archived",
        label: "Archived",
        className: "border-muted-foreground/40 text-muted-foreground",
      },
    ];
  }

  const badges: PermitStatusBadge[] = [];

  if (args.status === "PENDING_AUTHORIZATION") {
    badges.push({
      kind: "pending-authorization",
      label: PENDING_AUTHORIZATION_LABEL,
      className: "border-sky-600/40 text-sky-800",
    });
  } else if (args.status === "OPEN") {
    badges.push({
      kind: "open",
      label: "Open",
      className: "border-amber-600/40 text-amber-800",
    });
  } else {
    badges.push({
      kind: "closed",
      label: "Closed",
      className: "border-emerald-600/40 text-emerald-700",
    });
  }

  if (
    (args.status === "PENDING_AUTHORIZATION" || args.status === "OPEN") &&
    needsAuthorizedPersonnel(args.authorizedPersonnelCount)
  ) {
    badges.push({
      kind: "pending-authorized-personnel",
      label: PENDING_AUTHORIZED_PERSONNEL_LABEL,
      className: "border-violet-600/40 text-violet-800",
    });
  }

  return badges;
}
