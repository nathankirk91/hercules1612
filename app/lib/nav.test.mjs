import assert from "node:assert/strict";

const {
  buildNavItems,
  buildPermitsBreadcrumbs,
  findNavGroup,
  groupHasMultipleSections,
  groupIsActive,
  navLabels,
  pathMatches,
} = await import("./nav.ts");

const signedOut = buildNavItems({
  signedIn: false,
  canReview: false,
  canManageOperators: false,
  canManageUsers: false,
  canManageRoles: false,
});
assert.deepEqual(navLabels(signedOut), ["Home"]);

const operatorNav = buildNavItems({
  signedIn: true,
  canReview: false,
  canManageOperators: false,
  canManageUsers: false,
  canManageRoles: false,
});
assert.deepEqual(navLabels(operatorNav), [
  "Home",
  "Permits",
  "Inspections",
  "Calculations",
]);
assert.equal(operatorNav.some((item) => item.label === "Approvals"), false);
const operatorCalculations = findNavGroup(operatorNav, "calculations");
assert.ok(operatorCalculations);
assert.equal(
  operatorCalculations.children.some((child) => child.label === "Approvals"),
  false,
);
assert.equal(groupHasMultipleSections(operatorCalculations), false);

const managerNav = buildNavItems({
  signedIn: true,
  canReview: true,
  canManageOperators: true,
  canManageUsers: false,
  canManageRoles: false,
  pendingCount: 3,
});
assert.deepEqual(navLabels(managerNav), [
  "Home",
  "Permits",
  "Inspections",
  "Calculations",
  "Settings",
]);

const calculations = findNavGroup(managerNav, "calculations");
assert.ok(calculations);
assert.equal(calculations.badge, 3);
assert.equal(groupHasMultipleSections(calculations), true);
assert.deepEqual(
  calculations.children.map((child) => ({
    label: child.label,
    section: child.section,
    badge: child.badge,
  })),
  [
    { label: "Calculators", section: "Calculators", badge: undefined },
    { label: "History", section: "Calculators", badge: undefined },
    { label: "Approvals", section: "Approvals", badge: 3 },
  ],
);

const permits = findNavGroup(managerNav, "permits");
assert.ok(permits);
assert.deepEqual(
  permits.children.map((child) => child.label),
  ["Dashboard", "Forms", "Records", "Manage", "Settings"],
);
assert.equal(permits.children[0]?.to, "/permits/dashboard");

const inspections = findNavGroup(managerNav, "inspections");
assert.ok(inspections);
assert.deepEqual(
  inspections.children.map((child) => child.label),
  ["Checklists", "Records", "Manage", "Categories"],
);

assert.equal(
  groupIsActive({ pathname: "/approvals", hash: "" }, calculations),
  true,
);
assert.equal(
  groupIsActive({ pathname: "/", hash: "#calculations" }, calculations),
  true,
);
assert.equal(
  groupIsActive({ pathname: "/", hash: "" }, calculations),
  false,
);

assert.equal(
  pathMatches({ pathname: "/permits", hash: "" }, "/permits"),
  true,
);
assert.equal(
  pathMatches({ pathname: "/permits/dashboard", hash: "" }, "/permits"),
  false,
);
assert.equal(
  pathMatches(
    { pathname: "/permits/dashboard", hash: "" },
    "/permits/dashboard",
  ),
  true,
);

assert.deepEqual(buildPermitsBreadcrumbs("/permits"), [
  { label: "Permits", to: "/permits" },
  { label: "Forms" },
]);
assert.deepEqual(buildPermitsBreadcrumbs("/permits/dashboard"), [
  { label: "Permits", to: "/permits" },
  { label: "Dashboard" },
]);
assert.deepEqual(buildPermitsBreadcrumbs("/permits/history"), [
  { label: "Permits", to: "/permits" },
  { label: "Records" },
]);
assert.deepEqual(buildPermitsBreadcrumbs("/permits/manage"), [
  { label: "Permits", to: "/permits" },
  { label: "Manage" },
]);
assert.deepEqual(
  buildPermitsBreadcrumbs("/permits/manage/abc", [
    { label: "Hot Work Permit" },
  ]),
  [
    { label: "Permits", to: "/permits" },
    { label: "Manage", to: "/permits/manage" },
    { label: "Hot Work Permit" },
  ],
);
assert.deepEqual(buildPermitsBreadcrumbs("/permits/settings"), [
  { label: "Permits", to: "/permits" },
  { label: "Settings" },
]);
assert.deepEqual(buildPermitsBreadcrumbs("/permits/runs/run-1"), [
  { label: "Permits", to: "/permits" },
  { label: "Records" },
]);
assert.equal(
  pathMatches({ pathname: "/permits/manage/abc", hash: "" }, "/permits/manage"),
  true,
);


const adminNav = buildNavItems({
  signedIn: true,
  canReview: true,
  canManageOperators: true,
  canManageUsers: true,
  canManageRoles: true,
});
const settings = findNavGroup(adminNav, "settings");
assert.ok(settings);
assert.deepEqual(
  settings.children.map((child) => child.label),
  ["Notifications", "Users", "Roles"],
);

console.log("nav tests passed");
