import assert from "node:assert/strict";

const {
  buildInspectionSectionReport,
  parseSectionResponseMap,
} = await import("./inspection-section-report.ts");

{
  assert.deepEqual(parseSectionResponseMap(null), {});
  assert.deepEqual(parseSectionResponseMap({ "q-1": "Yes", "q-2": 12 }), {
    "q-1": "Yes",
    "q-2": "12",
  });
  assert.deepEqual(
    parseSectionResponseMap([
      { questionId: "q-1", answer: "No" },
      { questionId: "  ", answer: "x" },
      { answer: "orphan" },
    ]),
    { "q-1": "No" },
  );
}

{
  const report = buildInspectionSectionReport({
    sectionTitle: "Before start",
    sectionDefinition: {
      id: "demo",
      slug: "demo",
      title: "Demo",
      shortName: "Demo",
      description: "",
      category: "general",
      href: "/inspections/demo",
      sortOrder: 1,
      isAvailable: true,
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
      ],
      sections: [
        {
          id: "sec-before",
          title: "Before start",
          requiresSignature: true,
          sortOrder: 1,
        },
      ],
    },
    responses: { "q-tag": "Yes" },
    signature: "data:image/png;base64,abc",
    completedByName: "Alex",
    completedAt: "2026-10-16T01:00:00.000Z",
  });

  assert.equal(report.sectionTitle, "Before start");
  assert.equal(report.completedByName, "Alex");
  assert.equal(report.signature, "data:image/png;base64,abc");
  assert.equal(report.answers.length, 1);
  assert.equal(report.answers[0].questionId, "q-tag");
  assert.equal(report.answers[0].answer, "Yes");
  assert.equal(report.answers[0].flagged, true);
}

console.log("inspection-section-report unit tests passed");
