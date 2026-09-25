import assert from "node:assert/strict";

const {
  activePermitsSectionNavTo,
  buildNavItems,
  findNavGroup,
  groupHasMultipleSections,
  groupIsActive,
  navLabels,
  pathMatches,
  permitsSectionNavItems,
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

const operatorPermitsNav = permitsSectionNavItems({
  signedIn: true,
  canReview: false,
  canManageOperators: false,
  canManageUsers: false,
  canManageRoles: false,
});
assert.deepEqual(
  operatorPermitsNav.map((child) => child.label),
  ["Dashboard", "Forms", "Records"],
);
assert.equal(
  activePermitsSectionNavTo({ pathname: "/permits", hash: "" }, operatorPermitsNav),
  "/permits",
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/dashboard", hash: "" },
    operatorPermitsNav,
  ),
  "/permits/dashboard",
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/history", hash: "" },
    operatorPermitsNav,
  ),
  "/permits/history",
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/runs/abc", hash: "" },
    operatorPermitsNav,
  ),
  undefined,
);

const managerPermitsNav = permitsSectionNavItems({
  signedIn: true,
  canReview: true,
  canManageOperators: true,
  canManageUsers: false,
  canManageRoles: false,
});
assert.deepEqual(
  managerPermitsNav.map((child) => child.label),
  ["Dashboard", "Forms", "Records", "Manage", "Settings"],
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/manage", hash: "" },
    managerPermitsNav,
  ),
  "/permits/manage",
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/manage/form-1", hash: "" },
    managerPermitsNav,
  ),
  "/permits/manage",
);
assert.equal(
  activePermitsSectionNavTo(
    { pathname: "/permits/settings", hash: "" },
    managerPermitsNav,
  ),
  "/permits/settings",
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
