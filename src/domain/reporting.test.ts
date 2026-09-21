import assert from "node:assert/strict";
import { test } from "node:test";
import type { Invoice, Transaction } from "../lib/types.ts";
import {
  cashFlow,
  daysBetween,
  estimatedProfit,
  productMovement,
  receivableAging,
} from "./reporting.ts";

const AS_OF = "2026-09-21";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv_1",
    invoiceNumber: "INV-1",
    type: "sale",
    paymentType: "credit",
    partyId: "cust_1",
    date: "2026-09-01",
    items: [],
    subTotal: 0,
    discount: 0,
    total: 0,
    paidAmount: 0,
    remainingAmount: 0,
    status: "unpaid",
    isApproved: true,
    createdAt: "2026-09-01T08:00:00.000Z",
    ...overrides,
  } as Invoice;
}

test("daysBetween يحسب الفرق بالأيام ويتجاهل الوقت", () => {
  assert.equal(daysBetween("2026-09-01", "2026-09-21"), 20);
  assert.equal(daysBetween("2026-09-21T23:59:00.000Z", "2026-09-21T00:01:00.000Z"), 0);
  assert.equal(daysBetween("غير صالح", AS_OF), 0);
});

test("أعمار الديون توزّع المتبقي فقط على الشرائح", () => {
  const result = receivableAging(
    [
      invoice({ id: "a", date: "2026-09-10", remainingAmount: 500 }), // 11 يوم
      invoice({ id: "b", date: "2026-08-10", remainingAmount: 300 }), // 42 يوم
      invoice({ id: "c", date: "2026-06-01", remainingAmount: 200 }), // 112 يوم
      invoice({ id: "d", date: "2026-09-10", remainingAmount: 0 }), // مسددة → تُستبعد
      invoice({ id: "e", date: "2026-09-10", isCancelled: true, remainingAmount: 900 }), // ملغاة
      invoice({ id: "f", type: "purchase", partyId: "sup_1", date: "2026-09-10", remainingAmount: 700 }),
    ],
    AS_OF,
  );
  assert.equal(result.total, 1000);
  assert.equal(result.buckets.current, 500);
  assert.equal(result.buckets.d30, 300);
  assert.equal(result.buckets.d90, 200);
  assert.equal(result.byParty.length, 1);
  assert.equal(result.byParty[0].partyId, "cust_1");
});

test("أعمار الديون تجمع العميل الواحد في صف واحد مع أقدم دين", () => {
  const result = receivableAging(
    [
      invoice({ id: "a", date: "2026-09-18", remainingAmount: 100 }),
      invoice({ id: "b", date: "2026-07-01", remainingAmount: 250 }),
    ],
    AS_OF,
  );
  assert.equal(result.byParty.length, 1);
  assert.equal(result.byParty[0].total, 350);
  assert.equal(result.byParty[0].oldestDays, 82);
  assert.equal(result.byParty[0].buckets.d60, 250);
});

test("حركة الأصناف تفصل الوارد عن الصادر وتستبعد الخدمات والملغاة", () => {
  const rows = productMovement([
    invoice({
      id: "p1",
      type: "purchase",
      date: "2026-09-05",
      items: [{ id: "l1", inventoryItemId: "prod_1", name: "خيط", quantity: 100, unitPrice: 1, total: 100 }],
    }),
    invoice({
      id: "s1",
      date: "2026-09-06",
      items: [
        { id: "l2", inventoryItemId: "prod_1", name: "خيط", quantity: 30, unitPrice: 2, total: 60 },
        { id: "l3", inventoryItemId: "SERVICE", name: "تطريز", quantity: 5, unitPrice: 10, total: 50 },
      ],
    }),
    invoice({
      id: "s2",
      date: "2026-09-07",
      isCancelled: true,
      items: [{ id: "l4", inventoryItemId: "prod_1", name: "خيط", quantity: 50, unitPrice: 2, total: 100 }],
    }),
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { in: rows[0].inQty, out: rows[0].outQty, net: rows[0].netQty },
    { in: 100, out: 30, net: 70 },
  );
});

test("حركة الأصناف تحترم الفترة الزمنية", () => {
  const rows = productMovement(
    [
      invoice({
        id: "s1",
        date: "2026-01-05",
        items: [{ id: "l", inventoryItemId: "prod_1", name: "خيط", quantity: 10, unitPrice: 1, total: 10 }],
      }),
    ],
    { from: "2026-09-01", to: AS_OF },
  );
  assert.equal(rows.length, 0);
});

test("الأرباح التقديرية: خدمة بلا تكلفة + بضاعة بتكلفة البطاقة", () => {
  const result = estimatedProfit(
    [
      invoice({
        id: "svc",
        invoiceType: "SERVICE",
        total: 1000,
        items: [{ id: "l", inventoryItemId: "SERVICE", name: "تطريز", quantity: 1, unitPrice: 1000, total: 1000 }],
      }),
      invoice({
        id: "prod",
        total: 600,
        items: [{ id: "l2", inventoryItemId: "prod_1", name: "خيط", quantity: 20, unitPrice: 30, total: 600 }],
      }),
      invoice({ id: "issue", invoiceType: "ISSUE", total: 0 }),
    ],
    [{ id: "prod_1", costPrice: 10 }],
  );
  assert.equal(result.serviceRevenue, 1000);
  assert.equal(result.productRevenue, 600);
  assert.equal(result.estimatedCost, 200);
  assert.equal(result.grossProfit, 1400);
  assert.equal(result.marginPercent, (1400 / 1600) * 100);
  assert.equal(result.estimated, true);
});

test("حركة الصندوق: إجماليات وتفصيل حسب طريقة الدفع", () => {
  const transactions = [
    { id: "t1", date: "2026-09-10", cashIn: 500, cashOut: 0, paymentMethod: "cash" },
    { id: "t2", date: "2026-09-11", cashIn: 0, cashOut: 200, paymentMethod: "cash" },
    { id: "t3", date: "2026-09-12", cashIn: 300, cashOut: 0, paymentMethod: "network" },
    { id: "t4", date: "2026-01-01", cashIn: 999, cashOut: 0, paymentMethod: "cash" },
    { id: "t5", date: "2026-09-12", cashIn: 0, cashOut: 0, paymentMethod: "cash" },
  ] as unknown as Transaction[];
  const result = cashFlow(transactions, { from: "2026-09-01", to: AS_OF });
  assert.deepEqual(
    { in: result.in, out: result.out, net: result.net },
    { in: 800, out: 200, net: 600 },
  );
  assert.equal(result.byMethod.length, 2);
  assert.equal(result.byMethod[0].method, "cash");
  assert.deepEqual({ in: result.byMethod[0].in, out: result.byMethod[0].out }, { in: 500, out: 200 });
});
