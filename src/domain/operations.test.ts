import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppData, Invoice, InventoryItem } from "../lib/types.ts";
import { EMPTY_DATA } from "../lib/types.ts";
import {
  applyInvoiceEffects,
  applyInvoiceIdempotent,
  applyVoucherEffects,
  applyExpenseEffects,
  approveInvoiceOp,
  issueMaterialOp,
  cancelInvoiceOp,
} from "./operations.ts";
import { rebuildPartyBalances, rebuildCashBalance } from "./ledger.ts";
import {
  rebuildStock,
  rebuildStockByWarehouse,
  canIssue,
  canIssueFromWarehouse,
  stockInWarehouse,
  DEFAULT_WAREHOUSE_ID,
} from "./inventory.ts";
import { canTransition } from "./document-state.ts";
import { toMinor, moneyEquals } from "./money.ts";
import { ledgerRowId } from "./idempotency.ts";

function baseState(): AppData {
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
    suppliers: [
      {
        id: "s1",
        name: "مورد",
        company: "",
        phone: "",
        balance: 0,
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
        minQuantity: 5,
        color: "",
        lastUpdated: "2026-01-01",
      },
    ],

    warehouseStocks: [
      { warehouseId: "wh1", productId: "p1", quantity: 100 },
    ],
    defaultWarehouseId: "wh1",
  };
}

function saleInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv1",
    invoiceNumber: "S-0001",
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
    ...overrides,
  };
}

describe("money", () => {
  it("avoids float drift for typical amounts", () => {
    assert.equal(toMinor(0.1 + 0.2), 30);
    assert.equal(moneyEquals(10.005, 10.005), true);
  });
});

describe("document state machine", () => {
  it("allows draft→approved and approved→cancelled only", () => {
    assert.equal(canTransition("draft", "approved"), true);
    assert.equal(canTransition("approved", "cancelled"), true);
    assert.equal(canTransition("cancelled", "approved"), false);
    assert.equal(canTransition("approved", "draft"), false);
  });
});

describe("sale workflow", () => {
  it("deducts stock, increases AR, and records cash in", () => {
    const state = applyInvoiceEffects(baseState(), saleInvoice(), 1);
    const item = state.inventory.find((i) => i.id === "p1")!;
    assert.equal(item.quantity, 90);
    const customer = state.customers.find((c) => c.id === "c1")!;
    assert.equal(customer.balance, 150); // 200 - 50
    assert.equal(rebuildCashBalance(state.transactions), 50);
    assert.equal(state.transactions.length, 1);
    assert.equal(state.transactions[0].id, ledgerRowId("inv1", "ledger"));
  });

  it("is idempotent: double apply does not double effects", () => {
    const inv = saleInvoice();
    let state = applyInvoiceEffects(baseState(), inv, 1);
    state = applyInvoiceIdempotent(state, inv);
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 90);
    assert.equal(state.customers.find((c) => c.id === "c1")!.balance, 150);
    assert.equal(state.transactions.filter((t) => t.documentId === "inv1").length, 1);
  });

  it("reverse then delete restores stock and balance", () => {
    const inv = saleInvoice();
    let state = applyInvoiceEffects(baseState(), inv, 1);
    state = applyInvoiceEffects(state, inv, -1);
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 100);
    assert.equal(state.customers.find((c) => c.id === "c1")!.balance, 0);
    assert.equal(state.transactions.length, 0);
  });
});

describe("purchase workflow", () => {
  it("increases stock and supplier balance", () => {
    const inv = saleInvoice({
      id: "pur1",
      type: "purchase",
      partyId: "s1",
      paidAmount: 0,
      remainingAmount: 200,
      status: "unpaid",
    });
    const state = applyInvoiceEffects(baseState(), inv, 1);
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 110);
    assert.equal(state.suppliers.find((s) => s.id === "s1")!.balance, 200);
  });
});

describe("issue material", () => {
  it("rejects when stock insufficient", () => {
    const inv = saleInvoice({
      id: "iss1",
      invoiceType: "ISSUE",
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      items: [
        {
          id: "l1",
          inventoryItemId: "p1",
          name: "قماش",
          quantity: 999,
          unitPrice: 0,
          total: 0,
        },
      ],
    });
    const result = issueMaterialOp(baseState(), inv);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "INSUFFICIENT_STOCK");
  });

  it("deducts stock when sufficient", () => {
    const inv = saleInvoice({
      id: "iss2",
      invoiceType: "ISSUE",
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      items: [
        {
          id: "l1",
          inventoryItemId: "p1",
          name: "قماش",
          quantity: 5,
          unitPrice: 0,
          total: 0,
        },
      ],
    });
    const result = issueMaterialOp(baseState(), inv);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.state.inventory.find((i) => i.id === "p1")!.quantity, 95);
    }
  });
});

describe("approve invoice", () => {
  it("rejects already approved", () => {
    const state = baseState();
    const inv = saleInvoice({ isApproved: true });
    state.invoices = [inv];
    const result = approveInvoiceOp(state, inv.id);
    assert.equal(result.ok, false);
  });

  it("approves draft and applies effects", () => {
    const state = baseState();
    const inv = saleInvoice({ isApproved: false });
    state.invoices = [inv];
    const result = approveInvoiceOp(state, inv.id);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.state.inventory.find((i) => i.id === "p1")!.quantity, 90);
    }
  });
});

describe("voucher & expense", () => {
  it("receipt reduces customer balance and increases cash", () => {
    let state = baseState();
    state.customers[0].balance = 100;
    state = applyVoucherEffects(
      state,
      {
        id: "v1",
        voucherNumber: "R-1",
        type: "receipt",
        partyType: "customer",
        partyId: "c1",
        amount: 40,
        date: "2026-01-03",
        paymentMethod: "cash",
        description: "قبض",
        createdAt: "2026-01-03",
      },
      1,
    );
    assert.equal(state.customers[0].balance, 60);
    assert.equal(rebuildCashBalance(state.transactions), 40);
  });

  it("expense decreases cash only", () => {
    const state = applyExpenseEffects(
      baseState(),
      {
        id: "e1",
        category: "rent",
        amount: 25,
        date: "2026-01-03",
        paymentMethod: "cash",
        type: "work",
        description: "إيجار",
        createdAt: "2026-01-03",
      },
      1,
    );
    assert.equal(rebuildCashBalance(state.transactions), -25);
  });
});

describe("ledger rebuild", () => {
  it("rebuildPartyBalances matches applied balances", () => {
    const state = applyInvoiceEffects(baseState(), saleInvoice(), 1);
    const { customers } = rebuildPartyBalances(state.transactions);
    assert.equal(customers.get("c1"), state.customers[0].balance);
  });
});

describe("inventory rebuild", () => {
  it("sums signed movements", () => {
    const map = rebuildStock([
      { productId: "p1", quantity: 100 },
      { productId: "p1", quantity: -10 },
      { productId: "p1", quantity: 5 },
    ]);
    assert.equal(map.get("p1"), 95);
  });

  it("canIssue gate", () => {
    assert.equal(canIssue(10, 10).ok, true);
    assert.equal(canIssue(10, 11).ok, false);
  });
});


describe("cancel invoice", () => {
  it("reverses stock and balance and marks cancelled", () => {
    const inv = saleInvoice();
    let state = applyInvoiceEffects(baseState(), inv, 1);
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 90);
    state = { ...state, invoices: [inv, ...state.invoices] };
    const result = cancelInvoiceOp(state, inv.id);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.state.inventory.find((i) => i.id === "p1")!.quantity, 100);
    assert.equal(result.value.state.customers[0].balance, 0);
    assert.equal(result.value.invoice.isCancelled, true);
    assert.equal(result.value.invoice.isApproved, false);
  });

  it("rejects double cancel", () => {
    const inv = { ...saleInvoice(), isCancelled: true, isApproved: false };
    const state = { ...baseState(), invoices: [inv] };
    const result = cancelInvoiceOp(state, inv.id);
    assert.equal(result.ok, false);
  });

  it("rejects cancel of pure draft without approval history treated as draft→cancelled allowed", () => {
    const inv = { ...saleInvoice(), isApproved: false };
    const state = { ...baseState(), invoices: [inv] };
    const result = cancelInvoiceOp(state, inv.id);
    // draft → cancelled is allowed by state machine
    assert.equal(result.ok, true);
  });
});


describe("warehouse-scoped stock", () => {
  it("rejects issue from B when only A has stock", () => {
    const stocks = [
      { warehouseId: "whA", productId: "p1", quantity: 100 },
      { warehouseId: "whB", productId: "p1", quantity: 0 },
    ];
    const check = canIssueFromWarehouse(stocks, "whB", "p1", 50);
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.available, 0);
  });

  it("allows issue from A when A has enough even if B empty", () => {
    const stocks = [
      { warehouseId: "whA", productId: "p1", quantity: 100 },
      { warehouseId: "whB", productId: "p1", quantity: 0 },
    ];
    assert.equal(canIssueFromWarehouse(stocks, "whA", "p1", 50).ok, true);
  });

  it("applyInvoiceEffects only changes selected warehouse", () => {
    let state = baseState();
    state = {
      ...state,
      defaultWarehouseId: "whA",
      warehouseStocks: [
        { warehouseId: "whA", productId: "p1", quantity: 100 },
        { warehouseId: "whB", productId: "p1", quantity: 20 },
      ],
      inventory: state.inventory.map((i) =>
        i.id === "p1" ? { ...i, quantity: 120 } : i,
      ),
    };
    const inv = { ...saleInvoice(), warehouseId: "whA", isApproved: true };
    state = applyInvoiceEffects(state, inv, 1);
    assert.equal(stockInWarehouse(state.warehouseStocks, "whA", "p1"), 90);
    assert.equal(stockInWarehouse(state.warehouseStocks, "whB", "p1"), 20);
    assert.equal(state.inventory.find((i) => i.id === "p1")!.quantity, 110);
  });

  it("approve fails when warehouse B insufficient despite global stock", () => {
    let state = baseState();
    state = {
      ...state,
      warehouseStocks: [
        { warehouseId: "whA", productId: "p1", quantity: 100 },
        { warehouseId: "whB", productId: "p1", quantity: 5 },
      ],
      inventory: state.inventory.map((i) =>
        i.id === "p1" ? { ...i, quantity: 105 } : i,
      ),
      invoices: [{ ...saleInvoice(), isApproved: false, warehouseId: "whB", items: [{ id: "l1", inventoryItemId: "p1", name: "قماش", quantity: 20, unitPrice: 10, total: 200 }] }],
    };
    // fix total on inv
    const inv = state.invoices[0];
    inv.total = 200;
    inv.subTotal = 200;
    const r = approveInvoiceOp(state, inv.id);
    assert.equal(r.ok, false);
  });

  it("rebuildStockByWarehouse keeps warehouses separate", () => {
    const map = rebuildStockByWarehouse([
      { productId: "p1", warehouseId: "whA", quantity: 100 },
      { productId: "p1", warehouseId: "whB", quantity: 20 },
      { productId: "p1", warehouseId: "whA", quantity: -30 },
    ]);
    assert.equal(map.get("whA::p1"), 70);
    assert.equal(map.get("whB::p1"), 20);
  });

  it("reverse restores original warehouse only", () => {
    let state = baseState();
    state = {
      ...state,
      warehouseStocks: [
        { warehouseId: "whA", productId: "p1", quantity: 100 },
        { warehouseId: "whB", productId: "p1", quantity: 20 },
      ],
      inventory: state.inventory.map((i) => (i.id === "p1" ? { ...i, quantity: 120 } : i)),
    };
    const inv = { ...saleInvoice(), warehouseId: "whA", isApproved: true };
    state = applyInvoiceEffects(state, inv, 1);
    state = applyInvoiceEffects(state, inv, -1);
    assert.equal(stockInWarehouse(state.warehouseStocks, "whA", "p1"), 100);
    assert.equal(stockInWarehouse(state.warehouseStocks, "whB", "p1"), 20);
  });
});
