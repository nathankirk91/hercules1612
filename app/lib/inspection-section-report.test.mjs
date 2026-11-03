import assert from "node:assert/strict";

const {
  buildInspectionSectionReport,
  packSectionResponses,
  parseSectionResponseMap,
  parseSectionStoredNotes,
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
  const packed = packSectionResponses({
    answers: { "q-1": "Yes" },
    notes: "  Follow up on spill  ",
  });
  assert.deepEqual(packed, {
    answers: { "q-1": "Yes" },
    notes: "Follow up on spill",
  });
  assert.deepEqual(parseSectionResponseMap(packed), { "q-1": "Yes" });
  assert.equal(parseSectionStoredNotes(packed), "Follow up on spill");
  assert.equal(parseSectionStoredNotes({ "q-1": "Yes" }), null);
}

{
  const sectionDefinition = {
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
  };

  const withPackedNotes = buildInspectionSectionReport({
    sectionTitle: "Before start",
    sectionDefinition,
    responses: packSectionResponses({
      answers: { "q-tag": "Yes" },
      notes: "Section note",
    }),
    notesFallback: "Run-level note should be ignored",
    signature: "data:image/png;base64,abc",
    completedByName: "Alex",
    completedAt: "2026-10-16T01:00:00.000Z",
  });
  assert.equal(withPackedNotes.notes, "Section note");
  assert.equal(withPackedNotes.answers[0].flagged, true);

  const legacy = buildInspectionSectionReport({
    sectionTitle: "Before start",
    sectionDefinition,
    responses: { "q-tag": "No" },
    notesFallback: "Legacy run notes",
  });
  assert.equal(legacy.notes, "Legacy run notes");
  assert.equal(legacy.answers[0].flagged, false);

  const packedEmptyNotes = buildInspectionSectionReport({
    sectionTitle: "Before start",
    sectionDefinition,
    responses: packSectionResponses({
      answers: { "q-tag": "No" },
      notes: "",
    }),
    notesFallback: "Should not leak run notes",
  });
  assert.equal(packedEmptyNotes.notes, null);
}

console.log("inspection-section-report unit tests passed");
