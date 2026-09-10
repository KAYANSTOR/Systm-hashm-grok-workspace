import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createOutboxItem,
  mergeOutboxByOperationId,
  pendingItems,
  type OutboxItem,
} from "./outbox.ts";
import { drainOutbox } from "../application/sync-engine.ts";
import {
  mutateSaveInvoice,
  mutateIssueMaterial,
  mutateSaveVoucher,
  makeOperationId,
  mutateUpsertCustomer,
  mutateDeleteProduct,
} from "../application/mutate.ts";
import type { AppData, Invoice } from "../lib/types.ts";
import { EMPTY_DATA } from "../lib/types.ts";
import { applyInvoiceEffects } from "./operations.ts";
import { rebuildPartyBalances, rebuildCashBalance } from "./ledger.ts";
import { rebuildStock } from "./inventory.ts";

function base(): AppData {
  return {
    ...EMPTY_DATA,
    customers: [
      {
        id: "c1",
        name: "عميل",
        phone: "",
        address: "",
        balance: 0,
        type: "retail",
        createdAt: "2026-01-01",
      },
    ],
    inventory: [
      {
        id: "p1",
        code: "P1",
        name: "قماش",
        category: "fabric",
        unit: "meter",
        quantity: 100,
        costPrice: 10,
        sellingPrice: 20,
        minQuantity: 1,
        color: "",
        lastUpdated: "2026-01-01",
      },
    ],
    warehouseStocks: [{ warehouseId: "wh1", productId: "p1", quantity: 100 }],
    defaultWarehouseId: "wh1",

  };
}

function sale(id = "inv1"): Invoice {
  return {
    id,
    invoiceNumber: "S-1",
    type: "sale",
    paymentType: "partial",
    invoiceType: "PRODUCT_SALE",
    partyId: "c1",
    date: "2026-01-02",
    items: [
      {
        id: "line1",
        inventoryItemId: "p1",
        name: "قماش",
        quantity: 10,
        unitPrice: 20,
        total: 200,
      },
    ],
    subTotal: 200,
    discount: 0,
    total: 200,
    paidAmount: 50,
    remainingAmount: 150,
    paymentMethod: "cash",
    status: "partial",
    isApproved: true,
    createdAt: "2026-01-02",
  };
}

describe("outbox identity", () => {
  it("createOutboxItem uses operationId as primary key", () => {
    const item = createOutboxItem({
      operationId: "invoice.save:inv1",
      operationType: "invoice.save",
      documentId: "inv1",
      deviceId: "devA",
      payload: { id: "inv1" },
    });
    assert.equal(item.id, "invoice.save:inv1");
    assert.equal(item.status, "pending");
  });
});

describe("idempotency 1x 2x 5x 10x", () => {
  it("repeating mutateSaveInvoice same id does not multiply stock effects when applied once then re-saved", () => {
    let state = base();
    const inv = sale();
    for (let n = 0; n < 10; n++) {
      const r = mutateSaveInvoice(state, inv, state.invoices.find((i) => i.id === inv.id));
      assert.equal(r.ok, true);
      if (r.ok) state = r.value.state;
    }
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 90);
    assert.equal(state.customers[0].balance, 150);
    assert.equal(state.transactions.filter((t) => t.documentId === "inv1").length, 1);
  });
});

describe("sync drain", () => {
  it("marks done on applied and on duplicate", async () => {
    const items: OutboxItem[] = [
      createOutboxItem({
        operationId: "op1",
        operationType: "invoice.save",
        documentId: "inv1",
        deviceId: "devA",
        payload: {},
      }),
      createOutboxItem({
        operationId: "op2",
        operationType: "voucher.save",
        documentId: "v1",
        deviceId: "devA",
        payload: {},
      }),
    ];
    let calls = 0;
    const drained = await drainOutbox(items, async (item) => {
      calls++;
      if (item.operationId === "op1") return { status: "applied", operationId: "op1" };
      return { status: "duplicate", operationId: "op2" };
    }, {
      preflight: async () => ({ status: "ok" }),
      finalize: async (item) => ({ status: "completed", operationId: item.operationId }),
    });
    assert.equal(calls, 2);
    assert.equal(drained.every((i) => i.status === "done"), true);
  });

  it("keeps failed for retry", async () => {
    const items = [
      createOutboxItem({
        operationId: "opX",
        operationType: "expense.save",
        deviceId: "devA",
        payload: {},
      }),
    ];
    const drained = await drainOutbox(items, async () => {
      throw new Error("network down");
    }, {
      preflight: async () => ({ status: "ok" }),
      finalize: async (item) => ({ status: "completed", operationId: item.operationId }),
    });
    assert.equal(drained[0].status, "failed");
    assert.equal(drained[0].attempts, 1);
    assert.ok(drained[0].lastError);
  });
});

describe("multi-device offline merge", () => {
  it("two devices different invoices both survive", () => {
    const a = [
      createOutboxItem({
        operationId: "invoice.save:invA",
        operationType: "invoice.save",
        documentId: "invA",
        deviceId: "devA",
        payload: { id: "invA" },
      }),
    ];
    const b = [
      createOutboxItem({
        operationId: "invoice.save:invB",
        operationType: "invoice.save",
        documentId: "invB",
        deviceId: "devB",
        payload: { id: "invB" },
      }),
    ];
    const merged = mergeOutboxByOperationId(a, b);
    assert.equal(merged.length, 2);
  });

  it("same operationId from two devices collapses to one", () => {
    const a = [
      createOutboxItem({
        operationId: "invoice.save:inv1",
        operationType: "invoice.save",
        documentId: "inv1",
        deviceId: "devA",
        payload: { id: "inv1", paidAmount: 50 },
      }),
    ];
    const b = [
      createOutboxItem({
        operationId: "invoice.save:inv1",
        operationType: "invoice.save",
        documentId: "inv1",
        deviceId: "devB",
        payload: { id: "inv1", paidAmount: 50 },
      }),
    ];
    b[0].status = "done";
    const merged = mergeOutboxByOperationId(a, b);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].status, "done");
  });

  it("two offline sales on different docs produce independent stock effects when applied", () => {
    const stateA = base();
    const stateB = base();
    const invA = sale("invA");
    invA.items[0].quantity = 10;
    const invB = sale("invB");
    invB.items[0].quantity = 15;
    invB.items[0].id = "lineB";

    const rA = mutateSaveInvoice(stateA, invA);
    const rB = mutateSaveInvoice(stateB, invB);
    assert.equal(rA.ok && rB.ok, true);
    if (rA.ok && rB.ok) {
      // Server merge of documents: apply both effects onto shared base
      let merged = applyInvoiceEffects(base(), invA, 1);
      merged = applyInvoiceEffects(merged, invB, 1);
      assert.equal(merged.inventory.find((i) => i.id === "p1")!.quantity, 75);
      assert.equal(merged.transactions.length, 2);
      const { customers } = rebuildPartyBalances(merged.transactions);
      assert.equal(customers.get("c1"), 150 + 150); // each remaining 150 if paid 50 of 200 - wait totals differ
    }
  });
});

describe("accounting reconstruction", () => {
  it("rebuild from transactions matches projection", () => {
    const r = mutateSaveInvoice(base(), sale());
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const { customers } = rebuildPartyBalances(r.value.state.transactions);
    assert.equal(customers.get("c1"), r.value.state.customers[0].balance);
    assert.equal(rebuildCashBalance(r.value.state.transactions), 50);
  });
});

describe("inventory reconstruction", () => {
  it("signed movements equal stock delta", () => {
    const map = rebuildStock([
      { productId: "p1", quantity: 100 },
      { productId: "p1", quantity: -10 },
      { productId: "p1", quantity: -15 },
    ]);
    assert.equal(map.get("p1"), 75);
  });
});

describe("issue gate via application", () => {
  it("rejects over-issue", () => {
    const inv = sale("iss1");
    inv.invoiceType = "ISSUE";
    inv.total = 0;
    inv.paidAmount = 0;
    inv.items[0].quantity = 500;
    const r = mutateIssueMaterial(base(), inv);
    assert.equal(r.ok, false);
  });
});

describe("pending count", () => {
  it("lists pending and failed only", () => {
    const items = [
      createOutboxItem({
        operationId: "a",
        operationType: "invoice.save",
        deviceId: "d",
        payload: {},
      }),
      createOutboxItem({
        operationId: "b",
        operationType: "invoice.save",
        deviceId: "d",
        payload: {},
      }),
    ];
    items[1].status = "done";
    assert.equal(pendingItems(items).length, 1);
  });
});

describe("operation identity distinctness", () => {
  it("save approve delete on same document are different operation ids", () => {
    const doc = "inv123";
    const save = makeOperationId("invoice.save", doc);
    const approve = makeOperationId("invoice.approve", doc);
    const del = makeOperationId("invoice.delete", doc);
    assert.notEqual(save, approve);
    assert.notEqual(approve, del);
    assert.notEqual(save, del);
  });

  it("retries of same type+document collapse to same id", () => {
    const a = makeOperationId("voucher.save", "v9");
    const b = makeOperationId("voucher.save", "v9");
    assert.equal(a, b);
  });
});

describe("party product via application", () => {
  it("create customer with opening balance enqueues opening.balance", () => {
    const state = {
      ...EMPTY_DATA,
      customers: [],
      transactions: [],
    } as AppData;
    const r = mutateUpsertCustomer(
      state,
      {
        id: "c99",
        name: "عميل جديد",
        phone: "",
        address: "",
        balance: 100,
        type: "retail",
        createdAt: "2026-01-01",
      },
      true,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.outbox.operationType, "opening.balance");
      assert.equal(r.value.state.customers[0].balance, 100);
      assert.equal(r.value.audit.action, "create");
    }
  });

  it("delete product produces product.delete outbox", () => {
    const state = {
      ...EMPTY_DATA,
      inventory: [
        {
          id: "p9",
          code: "X",
          name: "مادة",
          category: "fabric" as const,
          unit: "meter" as const,
          quantity: 1,
          costPrice: 1,
          sellingPrice: 2,
          minQuantity: 0,
          color: "",
          lastUpdated: "2026-01-01",
        },
      ],
    } as AppData;
    const r = mutateDeleteProduct(state, "p9");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.outbox.operationType, "product.delete");
      assert.equal(r.value.state.inventory.length, 0);
    }
  });
});
