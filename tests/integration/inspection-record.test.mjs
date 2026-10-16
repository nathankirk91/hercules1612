import assert from "node:assert/strict";

const {
  evaluateSectionProgress,
  recordCanAutoComplete,
  definitionForSection,
} = await import("../../app/lib/inspection-workflow.ts");
const { createInspectionSchema } = await import(
  "../../app/lib/inspection.schema.ts"
);
const { buildInspectionSectionReport } = await import(
  "../../app/lib/inspection-section-report.ts"
);

const before = {
  id: "sec-before",
  title: "Before start",
  requiresSignature: true,
  sortOrder: 1,
};
const after = {
  id: "sec-after",
  title: "After start",
  requiresSignature: true,
  sortOrder: 2,
  skipWhenQuestionId: "q-tag",
  skipWhenEquals: "Yes",
};

const definition = {
  id: "demo",
  slug: "demo",
  title: "Demo",
  shortName: "Demo",
  description: "",
  category: "general",
  href: "/inspections/demo",
  sortOrder: 1,
  isAvailable: true,
  workflowMode: "SECTIONED",
  dayRecordPolicy: "ONE",
  sectionOrder: "STRICT",
  sections: [before, after],
  questions: [
    {
      id: "q-tag",
      label: "Tagged out",
      sectionId: "sec-before",
      sectionTitle: "Before start",
      type: "YES_NO",
      options: ["Yes", "No"],
      attentionValues: ["Yes"],
      required: true,
      showLastValue: false,
      applicableEquipmentRefs: [],
      applicableShifts: [],
      firstOfWeekOnly: false,
      sortOrder: 1,
    },
    {
      id: "q-brake",
      label: "Footbrake",
      sectionId: "sec-after",
      sectionTitle: "After start",
      type: "YES_NO",
      options: ["Yes", "No"],
      attentionValues: ["No"],
      required: true,
      showLastValue: false,
      applicableEquipmentRefs: [],
      applicableShifts: [],
      firstOfWeekOnly: false,
      sortOrder: 2,
    },
  ],
};

{
  const progress = evaluateSectionProgress({
    sections: [before, after],
    completions: [{ sectionId: "sec-before", status: "COMPLETE" }],
    responses: { "q-tag": "Yes" },
    sectionOrder: "STRICT",
  });
  assert.equal(progress[1].status, "skipped");
  assert.equal(recordCanAutoComplete(progress), true);
}

{
  const sectionOnly = definitionForSection(definition, "sec-before");
  assert.equal(sectionOnly.questions.length, 1);
  const schema = createInspectionSchema(sectionOnly);
  const parsed = schema.safeParse({
    operatorId: "op-1",
    notes: "",
    actions: [],
    sectionSignatures: { "sec-before": "JD" },
    responses: { "q-tag": "Yes" },
  });
  assert.equal(parsed.success, true);
  const missingAfter = schema.safeParse({
    operatorId: "op-1",
    notes: "",
    actions: [],
    sectionSignatures: { "sec-before": "JD" },
    responses: { "q-tag": "Yes", "q-brake": "" },
  });
  assert.equal(missingAfter.success, true);
}

{
  // Completed sections expose a read-only report from saved responses.
  const sectionOnly = definitionForSection(definition, "sec-before");
  const report = buildInspectionSectionReport({
    sectionTitle: "Before start",
    sectionDefinition: sectionOnly,
    responses: { "q-tag": "No" },
    signature: "data:image/png;base64,sig",
    completedByName: "Sam",
    completedAt: "2026-10-16T02:00:00.000Z",
  });
  assert.equal(report.answers.length, 1);
  assert.equal(report.answers[0].answer, "No");
  assert.equal(report.answers[0].flagged, false);
  assert.equal(report.signature, "data:image/png;base64,sig");
  assert.equal(report.completedByName, "Sam");
}

console.log("inspection-record integration tests passed");
