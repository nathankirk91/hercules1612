import assert from "node:assert/strict";

/**
 * Integration: inspection Zod schema + question applicability filters.
 * Ensures required validation and submit transforms only consider questions
 * that apply for the selected shift / first-of-week context.
 */
const {
  FORKLIFT_DAILY_CHECK_TEMPLATE,
  filterQuestionsForContext,
  filterQuestionsForEquipment,
  readShiftAnswer,
  sectionSignatureKey,
  sectionSignatureKeysForDefinition,
  sectionSignatureKeysForQuestions,
} = await import("../../app/lib/inspections.ts");
const { createInspectionSchema } = await import(
  "../../app/lib/inspection.schema.ts"
);
const { createInspectionFormSchema } = await import(
  "../../app/lib/inspection.schema.ts"
);
const { parseWithZod } = await import("@conform-to/zod/v4");

function sectionSignaturesFor(questions, value = "JD") {
  return Object.fromEntries(
    sectionSignatureKeysForQuestions(questions).map((key) => [key, value]),
  );
}

function basePayload(responses, questions = []) {
  return {
    operatorId: "op-1",
    equipmentRef: "H57168",
    notes: "",
    actions: [],
    sectionSignatures: sectionSignaturesFor(questions),
    responses,
  };
}

function fillRequired(questions, responses = {}) {
  /** @type {Record<string, string>} */
  const filled = { ...responses };
  for (const question of questions) {
    if (filled[question.id] != null && String(filled[question.id]).trim() !== "") {
      continue;
    }
    if (!question.required) {
      continue;
    }
    if (question.type === "YES_NO") {
      filled[question.id] = question.attentionValues.includes("Yes")
        ? "No"
        : "Yes";
    } else if (question.type === "RADIO") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      filled[question.id] = ok ?? question.options[0];
    } else if (question.type === "CHECKBOX") {
      filled[question.id] = question.options[0] ?? "";
    } else if (question.type === "NUMBER") {
      filled[question.id] = "100";
    } else if (question.type === "DATE") {
      filled[question.id] = "2026-07-28";
    } else if (question.type === "TIME") {
      filled[question.id] = "07:30";
    } else {
      filled[question.id] = "ok";
    }
  }
  return filled;
}

const template = FORKLIFT_DAILY_CHECK_TEMPLATE;
const weekly = template.questions.find((question) =>
  question.id.endsWith("__scrubber-drained"),
);
assert.ok(weekly, "expected first-of-week Day-only scrubber question");

const unitQuestions = filterQuestionsForEquipment(
  template.questions,
  "H57168",
);

{
  // Afternoon + not first week: weekly Day question must not be required.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: false },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Afternoon",
    isFirstInspectionOfWeek: false,
  });
  assert.equal(
    applicable.some((question) => question.id === weekly.id),
    false,
  );

  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Afternoon",
  });
  // Intentionally omit the weekly question answer.
  delete responses[weekly.id];

  const parsed = schema.safeParse(basePayload(responses, applicable));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.responses[weekly.id], undefined);
  assert.ok(
    !parsed.data.answers.some((answer) => answer.questionId === weekly.id),
  );
  assert.ok(parsed.data.sectionSignatures["After start"]);
  assert.equal(parsed.data.signature, "JD");
}

{
  // Day + first week: weekly question is required.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: true },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  assert.ok(applicable.some((question) => question.id === weekly.id));

  const responses = fillRequired(
    applicable.filter((question) => question.id !== weekly.id),
    { "forklift-daily-check__shift": "Day" },
  );
  delete responses[weekly.id];

  const parsed = schema.safeParse(basePayload(responses, applicable));
  assert.equal(parsed.success, false);
  const issue = parsed.error.issues.find(
    (row) =>
      Array.isArray(row.path) &&
      row.path[0] === "responses" &&
      row.path[1] === weekly.id,
  );
  assert.ok(issue, "expected required error on weekly question");
}

{
  // Successful Day + first week submit includes weekly answer in transform.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: true },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Day",
  });
  const parsed = schema.safeParse(basePayload(responses, applicable));
  assert.equal(parsed.success, true);
  assert.equal(
    readShiftAnswer(unitQuestions, parsed.data.responses),
    "Day",
  );
  assert.ok(parsed.data.responses[weekly.id]);
  assert.equal(parsed.data.summary.status, "PASSED");
  assert.ok(parsed.data.summary.answeredCount > 0);
}

{
  // Fixed equipment from unit form wins over payload equipmentRef.
  const schema = createInspectionSchema(
    {
      ...template,
      fixedEquipmentRef: "H20287",
      questions: filterQuestionsForEquipment(template.questions, "H20287"),
    },
    { isFirstInspectionOfWeek: true },
  );
  const questions = filterQuestionsForEquipment(template.questions, "H20287");
  const applicable = filterQuestionsForContext(questions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Day",
  });
  const parsed = schema.safeParse({
    ...basePayload(responses, applicable),
    equipmentRef: "H57168",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.equipmentRef, "H20287");
}

{
  // Missing a section signature fails validation.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: false },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Afternoon",
    isFirstInspectionOfWeek: false,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Afternoon",
  });
  const signatures = sectionSignaturesFor(applicable);
  delete signatures["Before start"];
  const parsed = schema.safeParse({
    ...basePayload(responses, applicable),
    sectionSignatures: signatures,
  });
  assert.equal(parsed.success, false);
  const issue = parsed.error.issues.find(
    (row) =>
      Array.isArray(row.path) &&
      row.path[0] === "sectionSignatures" &&
      row.path[1] === "Before start",
  );
  assert.ok(issue, "expected required error on Before start signature");
}

{
  const managedDefinition = {
    ...FORKLIFT_DAILY_CHECK_TEMPLATE,
    sections: [
      {
        id: "sec-before",
        title: "Before start",
        requiresSignature: true,
        sortOrder: 0,
      },
      {
        id: "sec-after",
        title: "After start",
        requiresSignature: false,
        sortOrder: 1,
      },
    ],
    questions: FORKLIFT_DAILY_CHECK_TEMPLATE.questions.map((question) => {
      const title = question.sectionTitle?.trim() ?? "";
      if (title === "Before start") {
        return { ...question, sectionId: "sec-before" };
      }
      if (title === "After start") {
        return { ...question, sectionId: "sec-after" };
      }
      return question;
    }),
  };
  const schema = createInspectionSchema(managedDefinition);
  const applicable = filterQuestionsForContext(managedDefinition.questions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Day",
  });
  const signatureKeys = sectionSignatureKeysForDefinition(
    managedDefinition,
    applicable,
  );
  assert.deepEqual(signatureKeys, ["sec-before"]);
  const parsedMissing = schema.safeParse({
    ...basePayload(responses, applicable),
    sectionSignatures: {},
  });
  assert.equal(parsedMissing.success, false);
  const parsedOk = schema.safeParse({
    ...basePayload(responses, applicable),
    sectionSignatures: { "sec-before": "JD" },
  });
  assert.equal(parsedOk.success, true);
}

{
  assert.equal(sectionSignatureKey(null), "__default__");
  assert.equal(sectionSignatureKey("  After start  "), "After start");
  assert.deepEqual(
    sectionSignatureKeysForQuestions([
      { sectionTitle: "A" },
      { sectionTitle: "A" },
      { sectionTitle: "B" },
      { sectionTitle: null },
    ]),
    ["A", "B", "__default__"],
  );
}

{
  // Empty action rows from Conform list fields should not block submit.
  const schema = createInspectionFormSchema({
    ...FORKLIFT_DAILY_CHECK_TEMPLATE,
    questions: [],
    sections: [],
  });
  const formData = new FormData();
  formData.set("operatorId", "op-1");
  formData.set("actions.0", "");
  const parsed = parseWithZod(formData, { schema });
  assert.equal(parsed.status, "success");
  assert.deepEqual(parsed.value?.actions, []);
}

{
  const schema = createInspectionSchema({
    ...FORKLIFT_DAILY_CHECK_TEMPLATE,
    questions: [],
    sections: [],
  });
  const parsed = schema.safeParse({
    operatorId: "op-1",
    notes: "",
    actions: { 0: "Follow up on spill kit" },
    sectionSignatures: {},
    responses: {},
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.actions, ["Follow up on spill kit"]);
}

{
  // Conform submits section signatures with dot notation, not bracket syntax.
  const schema = createInspectionFormSchema({
    ...FORKLIFT_DAILY_CHECK_TEMPLATE,
    sections: [
      {
        id: "sec-env",
        title: "Site Environmental",
        requiresSignature: true,
        sortOrder: 0,
      },
    ],
    questions: [
      {
        id: "q1",
        label: "Walkabout",
        sectionId: "sec-env",
        sectionTitle: "Site Environmental",
        type: "YES_NO",
        options: ["Yes", "No"],
        attentionValues: [],
        required: true,
        showLastValue: false,
        applicableEquipmentRefs: [],
        applicableShifts: [],
        firstOfWeekOnly: false,
        sortOrder: 1,
      },
    ],
  });
  const dotNotation = new FormData();
  dotNotation.set("operatorId", "op-1");
  dotNotation.set("responses.q1", "Yes");
  dotNotation.set("sectionSignatures.sec-env", "data:image/jpeg;base64,abc");
  const dotParsed = parseWithZod(dotNotation, { schema });
  assert.equal(dotParsed.status, "success");

  const bracketNotation = new FormData();
  bracketNotation.set("operatorId", "op-1");
  bracketNotation.set("responses.q1", "Yes");
  bracketNotation.set("sectionSignatures[sec-env]", "data:image/jpeg;base64,abc");
  const bracketParsed = parseWithZod(bracketNotation, { schema });
  assert.equal(bracketParsed.status, "error");
}

console.log("inspection-schema integration tests passed");
