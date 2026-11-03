import assert from "node:assert/strict";

/**
 * Integration: permit issue schema validates checklist responses and
 * transforms applicable answers into a summary. Authorized personnel and
 * close-out are separate later steps.
 */
const { SAFE_WORK_PERMIT } = await import("../../app/lib/inspections.ts");
const {
  AUTHORIZED_PERSONNEL_ARCHIVED_ERROR,
  AUTHORIZED_PERSONNEL_CLOSED_ERROR,
  AUTHORIZED_PERSONNEL_TITLE,
  authorizedPersonnelBlockedReason,
  canAcceptAuthorizedPersonnel,
  createAddAuthorizedPersonnelSchema,
  createPermitCloseoutSchema,
  createPermitIssueSchema,
  formatPermitNumber,
  isPermitCloseoutComplete,
  mergePermitCloseout,
  parseAuthorizedPersonnel,
} = await import("../../app/lib/permit.schema.ts");
const { melbournePermitYearMonth } = await import(
  "../../app/lib/datetime.ts"
);

const SAMPLE_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fillRequired(definition, overrides = {}) {
  /** @type {Record<string, string>} */
  const responses = {};
  for (const question of definition.questions) {
    if (!question.required) {
      continue;
    }
    if (question.type === "YES_NO") {
      responses[question.id] = question.attentionValues.includes("Yes")
        ? "No"
        : "Yes";
    } else if (question.type === "RADIO") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      responses[question.id] = ok ?? question.options[0];
    } else if (question.type === "CHECKBOX") {
      responses[question.id] = question.options[0] ?? "";
    } else if (question.type === "NUMBER") {
      responses[question.id] = "1";
    } else if (question.type === "DATE") {
      responses[question.id] = "2026-07-28";
    } else if (question.type === "TIME") {
      responses[question.id] =
        question.permitFieldRole === "end_time" ||
        question.id.endsWith("__end-time")
          ? "16:00"
          : "08:00";
    } else {
      responses[question.id] = "ok";
    }
  }
  return { ...responses, ...overrides };
}

{
  assert.equal(formatPermitNumber("2608", 2), "2608002");
  assert.equal(formatPermitNumber("2608", 12), "2608012");
  assert.equal(formatPermitNumber("2608", 2, "SW"), "SW2608002");
  assert.equal(formatPermitNumber("2608", 2, "sw"), "SW2608002");
  assert.equal(formatPermitNumber("2608", 2, ""), "2608002");
  assert.equal(formatPermitNumber("2608", 2, null), "2608002");
  assert.equal(
    melbournePermitYearMonth(new Date("2026-08-02T14:00:00.000Z")),
    "2608",
  );
  assert.equal(
    AUTHORIZED_PERSONNEL_TITLE,
    "Authorized Personnel Performing Work",
  );
}

{
  const { normalizePermitNumberPrefix } = await import(
    "../../app/lib/permit.schema.ts"
  );
  assert.equal(normalizePermitNumberPrefix("sw"), "SW");
  assert.equal(normalizePermitNumberPrefix("  HW "), "HW");
  assert.equal(normalizePermitNumberPrefix(""), "");
  assert.equal(normalizePermitNumberPrefix(null), "");
  assert.throws(() => normalizePermitNumberPrefix("S"), /two letters/);
  assert.throws(() => normalizePermitNumberPrefix("S1"), /two letters/);
  assert.throws(() => normalizePermitNumberPrefix("SWP"), /two letters/);
}

{
  assert.deepEqual(parseAuthorizedPersonnel(["Alex"]), [
    { name: "Alex", signature: "" },
  ]);
  assert.deepEqual(
    parseAuthorizedPersonnel([
      { name: "Alex", signature: SAMPLE_SIGNATURE },
      { name: "Sam", signature: "" },
    ]),
    [
      { name: "Alex", signature: SAMPLE_SIGNATURE },
      { name: "Sam", signature: "" },
    ],
  );
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.equipmentRef, "P-100");
  assert.deepEqual(parsed.data.authorizedPersonnel, []);
  assert.equal(parsed.data.summary.status, "PASSED");
  assert.ok(parsed.data.answers.length > 0);
  assert.equal(
    parsed.data.answers.some((row) =>
      row.questionId.endsWith("__permit-duration"),
    ),
    false,
  );
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const responses = fillRequired(SAFE_WORK_PERMIT);
  const required = SAFE_WORK_PERMIT.questions.find(
    (question) => question.required,
  );
  assert.ok(required);
  delete responses[required.id];

  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    responses,
  });
  assert.equal(parsed.success, false);
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    responses: fillRequired(SAFE_WORK_PERMIT, {
      "safe-work-permit__start-time": "07:00",
      "safe-work-permit__end-time": "20:00",
    }),
  });
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error.issues.some((issue) =>
      String(issue.message).includes("12 hours"),
    ),
  );
}

{
  assert.equal(
    canAcceptAuthorizedPersonnel({ status: "PENDING_AUTHORIZATION" }),
    true,
  );
  assert.equal(canAcceptAuthorizedPersonnel({ status: "OPEN" }), true);
  assert.equal(canAcceptAuthorizedPersonnel({ status: "CLOSED" }), false);
  assert.equal(
    canAcceptAuthorizedPersonnel({
      status: "OPEN",
      archivedAt: new Date("2026-01-01"),
    }),
    false,
  );
  assert.equal(
    authorizedPersonnelBlockedReason({ status: "CLOSED" }),
    AUTHORIZED_PERSONNEL_CLOSED_ERROR,
  );
  assert.equal(
    authorizedPersonnelBlockedReason({
      status: "OPEN",
      archivedAt: "2026-01-01",
    }),
    AUTHORIZED_PERSONNEL_ARCHIVED_ERROR,
  );
  assert.equal(
    authorizedPersonnelBlockedReason({ status: "OPEN" }),
    null,
  );
}

{
  const addSchema = createAddAuthorizedPersonnelSchema();
  const ok = addSchema.safeParse({
    intent: "add-authorized-personnel",
    authorizedPersonnel: [
      { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
      { name: "Sam Helper", signature: SAMPLE_SIGNATURE },
    ],
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.authorizedPersonnel.length, 2);

  const missingSignature = addSchema.safeParse({
    intent: "add-authorized-personnel",
    authorizedPersonnel: [{ name: "Alex Operator", signature: "" }],
  });
  assert.equal(missingSignature.success, false);
  assert.ok(
    missingSignature.error.issues.some(
      (issue) =>
        Array.isArray(issue.path) &&
        issue.path[0] === "authorizedPersonnel" &&
        issue.path[2] === "signature",
    ),
  );

  const missingName = addSchema.safeParse({
    intent: "add-authorized-personnel",
    authorizedPersonnel: [{ name: "  ", signature: SAMPLE_SIGNATURE }],
  });
  assert.equal(missingName.success, false);

  const hugeSignature = `data:image/jpeg;base64,${"A".repeat(250_001)}`;
  const tooLarge = addSchema.safeParse({
    intent: "add-authorized-personnel",
    authorizedPersonnel: [
      { name: "Alex Operator", signature: hugeSignature },
    ],
  });
  assert.equal(tooLarge.success, false);
  assert.ok(
    tooLarge.error.issues.some((issue) =>
      String(issue.message).includes("too large to save"),
    ),
  );
}

{
  assert.equal(
    isPermitCloseoutComplete({
      date: "2026-08-17",
      time: "15:30",
      operatorsInitials: SAMPLE_SIGNATURE,
      maintenanceInitials: "",
    }),
    false,
  );
  assert.equal(
    isPermitCloseoutComplete({
      date: "2026-08-17",
      time: "15:30",
      operatorsInitials: SAMPLE_SIGNATURE,
      maintenanceInitials: "JD",
    }),
    true,
  );

  const mergedPartial = mergePermitCloseout(null, {
    date: "2026-08-17",
    time: "15:30",
    operatorsInitials: SAMPLE_SIGNATURE,
  });
  assert.deepEqual(mergedPartial, {
    date: "2026-08-17",
    time: "15:30",
    operatorsInitials: SAMPLE_SIGNATURE,
    maintenanceInitials: "",
  });
  assert.equal(isPermitCloseoutComplete(mergedPartial), false);

  const mergedComplete = mergePermitCloseout(mergedPartial, {
    date: "2026-08-17",
    time: "16:00",
    maintenanceInitials: "JD",
  });
  assert.deepEqual(mergedComplete, {
    date: "2026-08-17",
    time: "16:00",
    operatorsInitials: SAMPLE_SIGNATURE,
    maintenanceInitials: "JD",
  });
  assert.equal(isPermitCloseoutComplete(mergedComplete), true);

  const operatorOnly = createPermitCloseoutSchema().safeParse({
    intent: "closeout",
    date: "2026-08-17",
    time: "15:30",
    operatorsInitials: SAMPLE_SIGNATURE,
  });
  assert.equal(operatorOnly.success, true);

  const maintenanceOnly = createPermitCloseoutSchema({
    date: "2026-08-17",
    time: "15:30",
    operatorsInitials: SAMPLE_SIGNATURE,
    maintenanceInitials: "",
  }).safeParse({
    intent: "closeout",
    date: "2026-08-17",
    time: "16:00",
    maintenanceInitials: "JD",
  });
  assert.equal(maintenanceOnly.success, true);

  const missingRemaining = createPermitCloseoutSchema({
    date: "2026-08-17",
    time: "15:30",
    operatorsInitials: SAMPLE_SIGNATURE,
    maintenanceInitials: "",
  }).safeParse({
    intent: "closeout",
    date: "2026-08-17",
    time: "16:00",
  });
  assert.equal(missingRemaining.success, false);

  const neither = createPermitCloseoutSchema().safeParse({
    intent: "closeout",
    date: "2026-08-17",
    time: "15:30",
  });
  assert.equal(neither.success, false);
}

{
  // Manager-built forms use cuid IDs + permitFieldRole instead of magic suffixes.
  const customPermit = {
    ...SAFE_WORK_PERMIT,
    id: "hot-work-custom",
    slug: "hot-work-custom",
    title: "Hot Work Permit",
    questions: [
      {
        id: "q-date",
        label: "Date",
        type: "DATE",
        options: [],
        attentionValues: [],
        required: true,
        showLastValue: false,
        applicableEquipmentRefs: [],
        applicableShifts: [],
        firstOfWeekOnly: false,
        sortOrder: 1,
        sectionTitle: "Permit details",
      },
      {
        id: "q-start",
        label: "Begin",
        type: "TIME",
        options: [],
        attentionValues: [],
        required: true,
        showLastValue: false,
        applicableEquipmentRefs: [],
        applicableShifts: [],
        firstOfWeekOnly: false,
        permitFieldRole: "start_time",
        sortOrder: 2,
        sectionTitle: "Permit details",
      },
      {
        id: "q-end",
        label: "Finish",
        type: "TIME",
        options: [],
        attentionValues: [],
        required: true,
        showLastValue: false,
        applicableEquipmentRefs: [],
        applicableShifts: [],
        firstOfWeekOnly: false,
        permitFieldRole: "end_time",
        sortOrder: 3,
        sectionTitle: "Permit details",
      },
      {
        id: "q-area",
        label: "Location",
        type: "TEXT",
        options: [],
        attentionValues: [],
        required: true,
        showLastValue: false,
        applicableEquipmentRefs: [],
        applicableShifts: [],
        firstOfWeekOnly: false,
        permitFieldRole: "area",
        sortOrder: 4,
        sectionTitle: "Permit details",
      },
    ],
  };

  const ok = createPermitIssueSchema(customPermit).safeParse({
    equipmentRef: "P-200",
    responses: {
      "q-date": "2026-08-17",
      "q-start": "08:00",
      "q-end": "16:00",
      "q-area": "Bay 3",
    },
  });
  assert.equal(ok.success, true);
  assert.equal(
    ok.data.answers.find((row) => row.questionId === "q-area")?.permitFieldRole,
    "area",
  );

  const tooLong = createPermitIssueSchema(customPermit).safeParse({
    equipmentRef: "P-200",
    responses: {
      "q-date": "2026-08-17",
      "q-start": "07:00",
      "q-end": "20:00",
      "q-area": "Bay 3",
    },
  });
  assert.equal(tooLong.success, false);
  assert.ok(
    tooLong.error.issues.some((issue) =>
      String(issue.message).includes("12 hours"),
    ),
  );
}

console.log("permit-schema integration tests passed");
