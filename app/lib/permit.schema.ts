import { z } from "zod";

import {
  buildAnswersFromResponses,
  filterQuestionsForContext,
  findQuestionByPermitFieldRole,
  parseCheckboxAnswer,
  summarizeInspectionAnswers,
  type InspectionDefinition,
} from "~/lib/inspections";
import { MAX_PERMIT_SIGNATURE_LENGTH } from "~/lib/permit-form-errors";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function buildResponseShape(definition: InspectionDefinition) {
  const responseShape: Record<string, z.ZodType<string | undefined>> = {};

  for (const question of definition.questions) {
    if (question.type === "TEXT") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .max(2000, "Keep the answer under 2000 characters.")
          .optional(),
      );
    } else if (question.type === "NUMBER") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^-?\d+(\.\d+)?$/, "Enter a valid number.")
          .optional(),
      );
    } else if (question.type === "DATE") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
          .optional(),
      );
    } else if (question.type === "TIME") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/, "Enter a valid 24-hour time.")
          .optional(),
      );
    } else if (question.type === "CHECKBOX") {
      responseShape[question.id] = z.preprocess((value) => {
        if (value == null || value === "") {
          return undefined;
        }
        if (Array.isArray(value)) {
          const joined = value
            .map((item) => String(item).trim())
            .filter(Boolean)
            .join("|");
          return joined || undefined;
        }
        const trimmed = String(value).trim();
        return trimmed || undefined;
      }, z.string().optional());
    } else if (question.type === "YES_NO") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z.enum(["Yes", "No"], { error: "Select Yes or No." }).optional(),
      );
    } else {
      const options = question.options;
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        options.length > 0
          ? z
              .enum(options as [string, ...string[]], {
                error: "Select an option.",
              })
              .optional()
          : z.string().min(1, "Select an option.").optional(),
      );
    }
  }

  return responseShape;
}

export const PERMIT_AUTH_SLOT_KEYS = [
  "operationsRep",
  "maintenanceRep",
  "safeWorkCoordinator",
] as const;

export type PermitAuthSlotKey = (typeof PERMIT_AUTH_SLOT_KEYS)[number];

/** Max distinct signers (one per authorisation slot). */
export const MAX_PERMIT_REQUIRED_SIGNERS = PERMIT_AUTH_SLOT_KEYS.length;

/** Default for Safe Work and new permit forms. */
export const DEFAULT_PERMIT_REQUIRED_SIGNERS = 2;

export function normalizeRequiredSignerCount(
  value: unknown,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_PERMIT_REQUIRED_SIGNERS;
  }
  return Math.min(
    MAX_PERMIT_REQUIRED_SIGNERS,
    Math.max(1, Math.round(n)),
  );
}

export const PERMIT_AUTH_SLOT_LABELS: Record<PermitAuthSlotKey, string> = {
  operationsRep: "Operations representative / Account manager",
  maintenanceRep: "Maintenance representative / Account technician",
  safeWorkCoordinator: "Safe work coordinator",
};

export const MAX_PERMIT_DURATION_HOURS = 12;

export type AuthorizedPerson = {
  name: string;
  /** Initials / signature data URL. Required when the person is added. */
  signature: string;
};

/** Section title for people authorised to perform the work. */
export const AUTHORIZED_PERSONNEL_TITLE =
  "Authorized Personnel Performing Work";

export const AUTHORIZED_PERSONNEL_CLOSED_ERROR =
  "Closed permits cannot accept authorized personnel.";

export const AUTHORIZED_PERSONNEL_ARCHIVED_ERROR =
  "Archived permits cannot accept authorized personnel.";

export const AUTHORIZED_PERSONNEL_STATUS_ERROR =
  "This permit cannot accept authorized personnel.";

/**
 * Authorized Personnel Performing Work can be added only while the permit is
 * pending authorization or open (and not archived). Closed permits are locked.
 */
export function canAcceptAuthorizedPersonnel(args: {
  status: "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";
  archivedAt?: Date | string | null;
}): boolean {
  if (args.archivedAt) {
    return false;
  }
  return (
    args.status === "PENDING_AUTHORIZATION" || args.status === "OPEN"
  );
}

export function authorizedPersonnelBlockedReason(args: {
  status: "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";
  archivedAt?: Date | string | null;
}): string | null {
  if (canAcceptAuthorizedPersonnel(args)) {
    return null;
  }
  if (args.archivedAt) {
    return AUTHORIZED_PERSONNEL_ARCHIVED_ERROR;
  }
  if (args.status === "CLOSED") {
    return AUTHORIZED_PERSONNEL_CLOSED_ERROR;
  }
  return AUTHORIZED_PERSONNEL_STATUS_ERROR;
}

/** Normalize a permit number prefix to exactly two uppercase A–Z letters, or empty. */
export function normalizePermitNumberPrefix(
  value: string | null | undefined,
): string {
  const trimmed = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!trimmed) {
    return "";
  }
  if (!/^[A-Z]{2}$/.test(trimmed)) {
    throw new Error(
      "Permit number prefix must be exactly two letters (A–Z), with no digits.",
    );
  }
  return trimmed;
}

export function formatPermitNumber(
  yearMonth: string,
  sequence: number,
  prefix: string | null | undefined = "",
): string {
  const normalizedPrefix = normalizePermitNumberPrefix(prefix);
  const body = `${yearMonth}${String(sequence).padStart(3, "0")}`;
  return normalizedPrefix ? `${normalizedPrefix}${body}` : body;
}

export function parseAuthorizedPersonnel(value: unknown): AuthorizedPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { name, signature: "" } : null;
      }
      if (item && typeof item === "object") {
        const row = item as { name?: unknown; signature?: unknown };
        const name = String(row.name ?? "").trim();
        if (!name) {
          return null;
        }
        return {
          name,
          signature: String(row.signature ?? "").trim(),
        };
      }
      return null;
    })
    .filter((person): person is AuthorizedPerson => person != null);
}

export function emptyPermitAuthorization(): PermitAuthorization {
  return {
    operationsRep: { userId: "", name: "", signature: "" },
    maintenanceRep: { userId: "", name: "", signature: "" },
    safeWorkCoordinator: { userId: "", name: "", signature: "" },
  };
}

export function isPermitAuthSlotSigned(
  person: PermitAuthorizationPerson | null | undefined,
): boolean {
  return Boolean(person?.userId?.trim() && person?.signature?.trim());
}

export function isPermitFullyAuthorized(
  authorization: PermitAuthorization,
): boolean {
  return PERMIT_AUTH_SLOT_KEYS.every((key) =>
    isPermitAuthSlotSigned(authorization[key]),
  );
}

export function distinctPermitSignerIds(
  authorization: PermitAuthorization,
): string[] {
  return [
    ...new Set(
      PERMIT_AUTH_SLOT_KEYS.map((key) => authorization[key].userId.trim()).filter(
        Boolean,
      ),
    ),
  ];
}

/** Open once enough distinct people have signed (third slot may still be blank when only 2 are required). */
export function isPermitReadyToOpen(
  authorization: PermitAuthorization,
  requiredSignerCount: number = DEFAULT_PERMIT_REQUIRED_SIGNERS,
): boolean {
  const required = normalizeRequiredSignerCount(requiredSignerCount);
  return distinctPermitSignerIds(authorization).length >= required;
}

export function userHasAlreadySignedPermit(
  authorization: PermitAuthorization,
  userId: string,
): boolean {
  const id = userId.trim();
  if (!id) {
    return false;
  }
  return PERMIT_AUTH_SLOT_KEYS.some(
    (key) =>
      isPermitAuthSlotSigned(authorization[key]) &&
      authorization[key].userId.trim() === id,
  );
}

export function formatPermitDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${hours}h ${mins}m`;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Duration in minutes from start→end, allowing overnight wrap within 24h. */
export function permitDurationMinutes(
  startTime: string,
  endTime: string,
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) {
    return null;
  }
  let duration = end - start;
  if (duration <= 0) {
    duration += 24 * 60;
  }
  return duration;
}

export function createPermitIssueFormSchema(definition: InspectionDefinition) {
  return z
    .object({
      equipmentRef: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .min(1, `${definition.equipmentLabel ?? "Equipment"} is required.`)
          .max(80, "Keep the reference under 80 characters.")
          .optional(),
      ),
      responses: z.object(buildResponseShape(definition)),
    })
    .superRefine((value, ctx) => {
      if (definition.equipmentLabel && !value.equipmentRef) {
        ctx.addIssue({
          code: "custom",
          message: `${definition.equipmentLabel} is required.`,
          path: ["equipmentRef"],
        });
      }

      const applicableQuestions = filterQuestionsForContext(
        definition.questions,
        { isFirstInspectionOfWeek: true },
      );

      for (const question of applicableQuestions) {
        const answer = value.responses[question.id];
        if (question.required && (answer == null || String(answer).trim() === "")) {
          ctx.addIssue({
            code: "custom",
            message:
              question.type === "TEXT" ||
              question.type === "NUMBER" ||
              question.type === "DATE" ||
              question.type === "TIME"
                ? "Enter an answer."
                : question.type === "CHECKBOX"
                  ? "Select at least one option."
                  : "Select an answer.",
            path: ["responses", question.id],
          });
        }
        if (
          question.type === "CHECKBOX" &&
          answer != null &&
          String(answer).trim() !== ""
        ) {
          const allowed = new Set(question.options);
          const invalid = parseCheckboxAnswer(String(answer)).filter(
            (item) => !allowed.has(item),
          );
          if (invalid.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: "Select valid options only.",
              path: ["responses", question.id],
            });
          }
        }
      }

      const startId = findQuestionByPermitFieldRole(
        applicableQuestions,
        "start_time",
      )?.id;
      const endId = findQuestionByPermitFieldRole(
        applicableQuestions,
        "end_time",
      )?.id;
      if (startId && endId) {
        const start = String(value.responses[startId] ?? "");
        const end = String(value.responses[endId] ?? "");
        if (start && end) {
          const minutes = permitDurationMinutes(start, end);
          if (minutes == null) {
            ctx.addIssue({
              code: "custom",
              message: "Enter valid start and end times.",
              path: ["responses", endId],
            });
          } else if (minutes > MAX_PERMIT_DURATION_HOURS * 60) {
            ctx.addIssue({
              code: "custom",
              message: `Permit duration (from start to end) cannot exceed ${MAX_PERMIT_DURATION_HOURS} hours.`,
              path: ["responses", endId],
            });
          }
        }
      }
    });
}

export function createPermitIssueSchema(definition: InspectionDefinition) {
  return createPermitIssueFormSchema(definition).transform((value) => {
    const applicableQuestions = filterQuestionsForContext(
      definition.questions,
      { isFirstInspectionOfWeek: true },
    );
    const responses: Record<string, string> = {};
    for (const question of applicableQuestions) {
      responses[question.id] = String(value.responses[question.id] ?? "");
    }
    const answers = buildAnswersFromResponses(
      { ...definition, questions: applicableQuestions },
      responses,
    );
    const summary = summarizeInspectionAnswers(answers);

    return {
      equipmentRef: value.equipmentRef ?? null,
      authorizedPersonnel: [] as AuthorizedPerson[],
      responses,
      answers,
      summary,
    };
  });
}

/** Add one or more authorized people (name + sign-off) after issue. */
export function createAddAuthorizedPersonnelSchema() {
  return z
    .object({
      intent: z.literal("add-authorized-personnel"),
      authorizedPersonnel: z
        .array(
          z.object({
            name: z.preprocess(
              emptyToUndefined,
              z
                .string({ error: "Enter a name." })
                .trim()
                .min(1, "Enter a name.")
                .max(120, "Keep each name under 120 characters.")
                .optional(),
            ),
            signature: z.preprocess(
              emptyToUndefined,
              z.string({ error: "Sign-off is required." }).optional(),
            ),
          }),
        )
        .min(1, "Add at least one authorized person."),
    })
    .superRefine((value, ctx) => {
      value.authorizedPersonnel.forEach((person, index) => {
        const name = person.name?.trim() ?? "";
        const signature = person.signature?.trim() ?? "";
        if (!name) {
          ctx.addIssue({
            code: "custom",
            message: "Enter a name.",
            path: ["authorizedPersonnel", index, "name"],
          });
        }
        if (!signature) {
          ctx.addIssue({
            code: "custom",
            message: "Sign-off is required.",
            path: ["authorizedPersonnel", index, "signature"],
          });
        } else if (signature.length > MAX_PERMIT_SIGNATURE_LENGTH) {
          ctx.addIssue({
            code: "custom",
            message:
              "That signature is too large to save. Clear it and sign again with a simpler mark.",
            path: ["authorizedPersonnel", index, "signature"],
          });
        }
      });
    })
    .transform((value) => ({
      intent: value.intent,
      authorizedPersonnel: value.authorizedPersonnel.map((person) => ({
        name: person.name?.trim() ?? "",
        signature: person.signature?.trim() ?? "",
      })),
    }));
}

export function createPermitSignOffSchema(
  allowedSlotKeys: PermitAuthSlotKey[],
) {
  if (allowedSlotKeys.length === 0) {
    return z.object({
      intent: z.literal("sign-off"),
      slotKey: z.string(),
      signature: z.string(),
      siteVerified: z.string().optional(),
    }).superRefine((_value, ctx) => {
      ctx.addIssue({
        code: "custom",
        message: "You are not eligible to sign off on this permit.",
        path: ["slotKey"],
      });
    });
  }

  const slotKeySchema =
    allowedSlotKeys.length === 1
      ? z.literal(allowedSlotKeys[0])
      : z.enum(allowedSlotKeys as [PermitAuthSlotKey, ...PermitAuthSlotKey[]]);

  return z.object({
    intent: z.literal("sign-off"),
    slotKey: slotKeySchema,
    signature: z
      .string({ error: "Signature / initials are required." })
      .min(1, "Please sign or initial."),
    siteVerified: z
      .string({ error: "Confirm you inspected the job site." })
      .refine((value) => value === "on", {
        message: "Confirm you visually inspected the job site before signing.",
      }),
  });
}

export function isPermitCloseoutComplete(
  closeout: PermitCloseout | null | undefined,
): boolean {
  return Boolean(
    closeout?.date?.trim() &&
      closeout?.time?.trim() &&
      closeout?.operatorsInitials?.trim() &&
      closeout?.maintenanceInitials?.trim(),
  );
}

export function mergePermitCloseout(
  existing: PermitCloseout | null | undefined,
  incoming: {
    date: string;
    time: string;
    operatorsInitials?: string;
    maintenanceInitials?: string;
  },
): PermitCloseout {
  return {
    date: incoming.date.trim(),
    time: incoming.time.trim(),
    operatorsInitials:
      existing?.operatorsInitials?.trim() ||
      incoming.operatorsInitials?.trim() ||
      "",
    maintenanceInitials:
      existing?.maintenanceInitials?.trim() ||
      incoming.maintenanceInitials?.trim() ||
      "",
  };
}

/**
 * Operator and maintenance initials may be captured in separate rounds.
 * The permit closes only once both are present (see {@link isPermitCloseoutComplete}).
 */
export function createPermitCloseoutSchema(
  existing?: PermitCloseout | null,
) {
  const hasOperators = Boolean(existing?.operatorsInitials?.trim());
  const hasMaintenance = Boolean(existing?.maintenanceInitials?.trim());

  return z
    .object({
      intent: z.literal("closeout").optional(),
      date: z
        .string({ error: "Enter the close-out date." })
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
      time: z
        .string({ error: "Enter the close-out time." })
        .trim()
        .regex(/^\d{2}:\d{2}$/, "Enter a valid 24-hour time."),
      operatorsInitials: z.preprocess(
        emptyToUndefined,
        z.string().optional(),
      ),
      maintenanceInitials: z.preprocess(
        emptyToUndefined,
        z.string().optional(),
      ),
    })
    .superRefine((value, ctx) => {
      const submittingOperators = Boolean(value.operatorsInitials?.trim());
      const submittingMaintenance = Boolean(
        value.maintenanceInitials?.trim(),
      );

      if (hasOperators && hasMaintenance) {
        ctx.addIssue({
          code: "custom",
          message: "This permit is already fully signed for close-out.",
          path: ["operatorsInitials"],
        });
        return;
      }

      if (!hasOperators && !submittingOperators && !hasMaintenance && !submittingMaintenance) {
        ctx.addIssue({
          code: "custom",
          message:
            "Add operator or maintenance initials to record close-out progress.",
          path: ["operatorsInitials"],
        });
        return;
      }

      // When one side is already done, the remaining side is required this round.
      if (hasOperators && !hasMaintenance && !submittingMaintenance) {
        ctx.addIssue({
          code: "custom",
          message: "Maintenance personnel involved must initial the close-out.",
          path: ["maintenanceInitials"],
        });
      }
      if (hasMaintenance && !hasOperators && !submittingOperators) {
        ctx.addIssue({
          code: "custom",
          message: "Operators involved must initial the close-out.",
          path: ["operatorsInitials"],
        });
      }

      for (const [key, signature] of [
        ["operatorsInitials", value.operatorsInitials] as const,
        ["maintenanceInitials", value.maintenanceInitials] as const,
      ]) {
        if (
          signature &&
          signature.length > MAX_PERMIT_SIGNATURE_LENGTH
        ) {
          ctx.addIssue({
            code: "custom",
            message:
              "That signature is too large to save. Clear it and sign again with a simpler mark.",
            path: [key],
          });
        }
      }
    });
}

export type PermitIssueFormValues = z.infer<
  ReturnType<typeof createPermitIssueSchema>
>;
export type PermitAddAuthorizedPersonnelValues = z.infer<
  ReturnType<typeof createAddAuthorizedPersonnelSchema>
>;
export type PermitCloseoutValues = z.infer<
  ReturnType<typeof createPermitCloseoutSchema>
>;
export type PermitAuthorizationPerson = {
  userId: string;
  name: string;
  signature: string;
  /** ISO timestamp when signer confirmed site verification. */
  siteVerifiedAt?: string;
};

export type PermitAuthorization = {
  operationsRep: PermitAuthorizationPerson;
  maintenanceRep: PermitAuthorizationPerson;
  safeWorkCoordinator: PermitAuthorizationPerson;
  /** Legacy: retained for older permits that documented a one-signer exception. */
  fewerThanTwoSignersReason?: string;
};
export type PermitCloseout = {
  date: string;
  time: string;
  operatorsInitials: string;
  maintenanceInitials: string;
};
