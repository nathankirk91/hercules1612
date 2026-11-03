import assert from "node:assert/strict";

const {
  PENDING_AUTHORIZATION_LABEL,
  PENDING_AUTHORIZED_PERSONNEL_LABEL,
  needsAuthorizedPersonnel,
  permitRecordHeading,
  permitStatusBadges,
  permitStatusLabel,
  workDescriptionFromAnswers,
} = await import("./permit-display.ts");

{
  const answers = [
    {
      questionId: "safe-work-permit__work-to-be-performed",
      label: "Work to be performed",
      sectionTitle: "Work details",
      type: "TEXT",
      answer: "Change leaking pump",
      flagged: false,
    },
    {
      questionId: "safe-work-permit__area",
      label: "Area",
      sectionTitle: "Permit details",
      type: "TEXT",
      answer: "Kymene Building",
      flagged: false,
    },
  ];
  assert.equal(
    workDescriptionFromAnswers(answers),
    "Change leaking pump",
  );
  assert.equal(
    permitRecordHeading({
      workDescription: "Change leaking pump",
      equipmentRef: "Pump change",
      permitNumber: "2608002",
    }),
    "Change leaking pump",
  );
}

{
  assert.equal(
    permitRecordHeading({
      workDescription: null,
      equipmentRef: "Pump change",
      permitNumber: "2608002",
    }),
    "Pump change",
  );
  assert.equal(
    permitRecordHeading({
      workDescription: null,
      equipmentRef: null,
      permitNumber: "2608002",
    }),
    "#2608002",
  );
}

{
  assert.equal(permitStatusLabel("PENDING_AUTHORIZATION"), PENDING_AUTHORIZATION_LABEL);
  assert.equal(needsAuthorizedPersonnel(0), true);
  assert.equal(needsAuthorizedPersonnel(1), false);

  const pendingBoth = permitStatusBadges({
    status: "PENDING_AUTHORIZATION",
    authorizedPersonnelCount: 0,
  });
  assert.deepEqual(
    pendingBoth.map((badge) => badge.kind),
    ["pending-authorization", "pending-authorized-personnel"],
  );
  assert.equal(pendingBoth[0].label, PENDING_AUTHORIZATION_LABEL);
  assert.equal(pendingBoth[1].label, PENDING_AUTHORIZED_PERSONNEL_LABEL);

  const pendingAuthOnly = permitStatusBadges({
    status: "PENDING_AUTHORIZATION",
    authorizedPersonnelCount: 2,
  });
  assert.deepEqual(
    pendingAuthOnly.map((badge) => badge.kind),
    ["pending-authorization"],
  );

  const openNeedsPersonnel = permitStatusBadges({
    status: "OPEN",
    authorizedPersonnelCount: 0,
  });
  assert.deepEqual(
    openNeedsPersonnel.map((badge) => badge.kind),
    ["open", "pending-authorized-personnel"],
  );

  const openReady = permitStatusBadges({
    status: "OPEN",
    authorizedPersonnelCount: 1,
  });
  assert.deepEqual(
    openReady.map((badge) => badge.kind),
    ["open"],
  );

  const closed = permitStatusBadges({
    status: "CLOSED",
    authorizedPersonnelCount: 0,
  });
  assert.deepEqual(
    closed.map((badge) => badge.kind),
    ["closed"],
  );

  const archived = permitStatusBadges({
    status: "PENDING_AUTHORIZATION",
    authorizedPersonnelCount: 0,
    archivedAt: new Date("2026-01-01"),
  });
  assert.deepEqual(
    archived.map((badge) => badge.kind),
    ["archived"],
  );
}

console.log("permit-display tests passed");
