import assert from "node:assert/strict";

const {
  evaluateSectionProgress,
  isSectionedWorkflow,
  parseDayRecordPolicy,
  parseInspectionShift,
  parseSectionOrder,
  parseWorkflowMode,
  recordCanAutoComplete,
  recordSlotsForPolicy,
  requiredSectionsRemaining,
  sectionIsSkippedByAnswers,
  sectionsNeedingSkip,
  sortSectionProgressForDisplay,
} = await import("./inspection-workflow.ts");

{
  assert.equal(parseWorkflowMode("SECTIONED"), "SECTIONED");
  assert.equal(parseWorkflowMode("SINGLE_SUBMIT"), "SINGLE_SUBMIT");
  assert.equal(parseWorkflowMode(null), "SINGLE_SUBMIT");
  assert.equal(parseDayRecordPolicy("PER_SHIFT"), "PER_SHIFT");
  assert.equal(parseSectionOrder("STRICT"), "STRICT");
  assert.equal(parseInspectionShift("Afternoon"), "Afternoon");
  assert.equal(parseInspectionShift("night"), null);
  assert.equal(isSectionedWorkflow({ workflowMode: "SECTIONED" }), true);
  assert.equal(isSectionedWorkflow({ workflowMode: "SINGLE_SUBMIT" }), false);
}

{
  const slots = recordSlotsForPolicy("PER_SHIFT");
  assert.equal(slots.length, 2);
  assert.equal(slots[0].openLabel, "Open Day record");
  assert.equal(slots[1].openLabel, "Open Afternoon record");
  assert.equal(recordSlotsForPolicy("ONE")[0].openLabel, "Open record");
}

const before = {
  id: "sec-before",
  title: "Before start",
  requiresSignature: true,
  sortOrder: 1,
};
const tagged = {
  id: "sec-tag",
  title: "Tagged out",
  requiresSignature: true,
  sortOrder: 2,
};
const after = {
  id: "sec-after",
  title: "After start",
  requiresSignature: true,
  sortOrder: 3,
  skipWhenQuestionId: "danger-tag",
  skipWhenEquals: "Yes",
};

{
  assert.equal(
    sectionIsSkippedByAnswers(after, { "danger-tag": "Yes" }),
    true,
  );
  assert.equal(
    sectionIsSkippedByAnswers(after, { "danger-tag": "No" }),
    false,
  );
}

{
  const progress = evaluateSectionProgress({
    sections: [before, tagged, after],
    completions: [],
    responses: {},
    sectionOrder: "STRICT",
  });
  assert.deepEqual(
    progress.map((item) => item.status),
    ["available", "locked", "locked"],
  );
  assert.equal(requiredSectionsRemaining(progress), 3);
  assert.equal(recordCanAutoComplete(progress), false);
}

{
  const progress = evaluateSectionProgress({
    sections: [before, tagged, after],
    completions: [{ sectionId: before.id, status: "COMPLETE" }],
    responses: {},
    sectionOrder: "STRICT",
  });
  assert.deepEqual(
    progress.map((item) => item.status),
    ["complete", "available", "locked"],
  );
}

{
  const progress = evaluateSectionProgress({
    sections: [before, tagged, after],
    completions: [
      { sectionId: before.id, status: "COMPLETE" },
      { sectionId: tagged.id, status: "COMPLETE" },
    ],
    responses: { "danger-tag": "Yes" },
    sectionOrder: "STRICT",
  });
  assert.deepEqual(
    progress.map((item) => item.status),
    ["complete", "complete", "skipped"],
  );
  assert.equal(recordCanAutoComplete(progress), true);
}

{
  const progress = evaluateSectionProgress({
    sections: [before, tagged, after],
    completions: [{ sectionId: tagged.id, status: "COMPLETE" }],
    responses: {},
    sectionOrder: "ANY",
  });
  assert.deepEqual(
    progress.map((item) => item.status),
    ["available", "complete", "available"],
  );
}

{
  const needing = sectionsNeedingSkip({
    sections: [before, tagged, after],
    completions: [{ sectionId: before.id, status: "COMPLETE" }],
    responses: { "danger-tag": "Yes" },
  });
  assert.deepEqual(
    needing.map((section) => section.id),
    [after.id],
  );
}

{
  const progress = [
    { section: before, status: "complete", completedByName: "A", completedAt: null },
    { section: tagged, status: "available", completedByName: null, completedAt: null },
    { section: after, status: "complete", completedByName: "B", completedAt: null },
    {
      section: { id: "sec-extra", title: "Extra", requiresSignature: false, sortOrder: 4 },
      status: "locked",
      completedByName: null,
      completedAt: null,
    },
  ];
  const sorted = sortSectionProgressForDisplay(progress);
  assert.deepEqual(
    sorted.map((item) => item.section.id),
    [tagged.id, "sec-extra", before.id, after.id],
  );
}

console.log("inspection-workflow unit tests passed");
