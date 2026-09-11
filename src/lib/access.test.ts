import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPath, filterNavByPermissions, hasAnyPermission } from "./access.ts";

test("access helpers fail closed when permissions are missing", () => {
  assert.equal(hasAnyPermission([], ["reports.read"]), false);
  assert.equal(canAccessPath("/reports", []), false);
  assert.equal(canAccessPath("/", []), true);
});

test("access helpers allow a page when any mapped permission is present", () => {
  assert.equal(canAccessPath("/reports", ["reports.read"]), true);
  assert.equal(canAccessPath("/inventory", ["inventory.issue"]), true);
  assert.equal(canAccessPath("/inventory", ["party.write"]), false);
});

test("longest route mapping protects nested access-control page", () => {
  assert.equal(canAccessPath("/settings/access-control", ["roles.manage"]), true);
  assert.equal(canAccessPath("/settings/access-control", ["settings.write"]), false);
  assert.equal(canAccessPath("/settings/unknown", ["settings.write"]), true);
});

test("navigation filtering keeps only permitted destinations", () => {
  const items = [{ to: "/" }, { to: "/reports" }, { to: "/employees" }];
  assert.deepEqual(filterNavByPermissions(items, ["reports.read"]), [{ to: "/" }, { to: "/reports" }]);
});
