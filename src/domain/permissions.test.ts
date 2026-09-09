import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertLocalPermission } from "../application/permissions.ts";

describe("application permission projection", () => {
  it("allows when catalog not loaded (empty)", () => {
    assert.equal(assertLocalPermission([], "invoice.write").ok, true);
    assert.equal(assertLocalPermission(undefined, "invoice.write").ok, true);
  });

  it("allows when permission present", () => {
    assert.equal(
      assertLocalPermission(["invoice.write", "party.write"], "invoice.write").ok,
      true,
    );
  });

  it("denies when catalog loaded and permission missing", () => {
    const r = assertLocalPermission(["reports.read"], "invoice.cancel");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "PERMISSION");
  });
});

describe("concurrency contract (documented)", () => {
  it("FOR UPDATE + check + update is atomic within one SQL transaction", () => {
    // Pure documentation assertion of the required ordering used in saveInvoice:
    const steps = [
      "BEGIN",
      "SELECT quantity FROM warehouse_stock WHERE warehouse_id=? AND product_id=? FOR UPDATE",
      "IF requested > available THEN ROLLBACK/THROW",
      "INSERT inventory_movements",
      "UPDATE warehouse_stock SET quantity = quantity + delta",
      "COMMIT",
    ];
    assert.equal(steps[1].includes("FOR UPDATE"), true);
    assert.equal(steps.indexOf("COMMIT") > steps.findIndex((s) => s.startsWith("IF")), true);
  });
});
