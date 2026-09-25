import assert from "node:assert/strict";

/**
 * Unit: permits hub secondary nav comes from the shared nav model so the
 * sidebar stays aligned with AppHeader menus.
 */
const { buildNavItems, findNavGroup, pathMatches } = await import("./nav.ts");

const operatorNav = buildNavItems({
  signedIn: true,
  canReview: false,
  canManageOperators: false,
  canManageUsers: false,
  canManageRoles: false,
});
const operatorPermits = findNavGroup(operatorNav, "permits");
assert.ok(operatorPermits);
assert.deepEqual(
  operatorPermits.children.map((child) => child.label),
  ["Dashboard", "Forms", "Records"],
);

const managerNav = buildNavItems({
  signedIn: true,
  canReview: true,
  canManageOperators: true,
  canManageUsers: false,
  canManageRoles: false,
});
const managerPermits = findNavGroup(managerNav, "permits");
assert.ok(managerPermits);
assert.deepEqual(
  managerPermits.children.map((child) => ({
    label: child.label,
    to: child.to,
  })),
  [
    { label: "Dashboard", to: "/permits/dashboard" },
    { label: "Forms", to: "/permits" },
    { label: "Records", to: "/permits/history" },
    { label: "Manage", to: "/permits/manage" },
    { label: "Settings", to: "/permits/settings" },
  ],
);

// Hub active states: Forms is exact-only so dashboard does not light it up.
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
    { pathname: "/permits/manage/abc", hash: "" },
    "/permits/manage",
  ),
  true,
);

console.log("permits sidebar nav tests passed");
