import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REPORT_ROW_LIMIT,
  REPORT_TAB_TITLES,
  buildReportDocument,
  reportMoney,
  type ReportDocumentInput,
} from "./report-document.ts";

/**
 * مستند التقرير المطبوع يُبنى من نفس أرقام الشاشة، فأي خطأ في التجميع هنا يعني
 * ورقة مطبوعة بأرقام مخالفة لما يراه المستخدم — لذلك تُغطّى المجاميع والحدود.
 */
function baseInput(overrides: Partial<ReportDocumentInput> = {}): ReportDocumentInput {
  return {
    tab: "overview",
    from: "2026-09-01",
    to: "2026-09-30",
    salesTotal: 1000,
    collected: 400,
    receiptsTotal: 250,
    expenseTotal: 100,
    cashBalance: 550,
    stockValue: 5000,
    expensesByCategory: [
      ["إيجار", 60],
      ["كهرباء", 40],
    ],
    dailySales: [
      { date: "2026-09-01", total: 600 },
      { date: "2026-09-02", total: 0 },
      { date: "2026-09-03", total: 400 },
    ],
    invoices: [],
    cashRows: [],
    stock: [],
    partyRows: [],
    partyBalance: 0,
    agingBuckets: [],
    agingTotal: 0,
    agingByParty: [],
    profit: {
      serviceRevenue: 900,
      productRevenue: 100,
      estimatedCost: 300,
      grossProfit: 700,
      marginPercent: 70,
    },
    movement: [],
    flow: { in: 0, out: 0, net: 0, byMethod: [] },
    activity: [],
    ...overrides,
  };
}

function section(document: ReturnType<typeof buildReportDocument>, title: string) {
  const found = document.sections.find((item) => item.title === title);
  assert.ok(found, `المستند يجب أن يحتوي قسم «${title}»`);
  return found;
}

test("reportMoney يطبع رقمًا واحدًا بفاصل آلاف وبلا رمز عملة", () => {
  assert.equal(reportMoney(1234.5), "1,234.5");
  assert.equal(reportMoney(0), "0");
  assert.equal(reportMoney(Number.NaN), "0");
});

test("تبويب الملخص يبني المؤشرات وأيام المبيعات بلا تكرار الأيام الصفرية", () => {
  const document = buildReportDocument(baseInput({ tab: "overview" }));

  assert.equal(document.title, REPORT_TAB_TITLES.overview);
  assert.equal(document.periodFrom, "2026-09-01");
  assert.equal(document.periodTo, "2026-09-30");

  const kpis = section(document, "المؤشرات الرئيسية").kpis ?? [];
  assert.equal(kpis.length, 6);
  assert.equal(kpis[0]?.value, "1,000 ر.ي");
  assert.equal(kpis[3]?.value, "100 ر.ي");

  const categories = section(document, "المصروفات حسب الفئة");
  assert.deepEqual(categories.rows, [
    ["إيجار", "60"],
    ["كهرباء", "40"],
  ]);

  const days = section(document, "المبيعات اليومية");
  assert.equal(days.rows?.length, 2, "الأيام بلا مبيعات لا تُطبع");
  assert.deepEqual(days.foot, ["الإجمالي", "1,000"]);
});

test("تبويب المبيعات يجمع الإجمالي والمدفوع في سطر الإجمالي", () => {
  const document = buildReportDocument(
    baseInput({
      tab: "sales",
      invoices: [
        {
          number: "S-1",
          date: "2026-09-02",
          party: "عميل أ",
          status: "آجل",
          total: 300,
          paid: 100,
        },
        {
          number: "S-2",
          date: "2026-09-05",
          party: "عميل ب",
          status: "نقدي",
          total: 200,
          paid: 200,
        },
      ],
    }),
  );

  const table = section(document, "الفواتير");
  assert.equal(table.rows?.length, 2);
  assert.equal(table.foot?.[4], "500");
  assert.equal(table.foot?.[5], "300");
  assert.match(table.subtitle ?? "", /2 فاتورة/);
});

test("تبويب المخزون يطبع المتبقي وقيمته ويشرح مصدر الكمية", () => {
  const document = buildReportDocument(
    baseInput({
      tab: "stock",
      stock: [
        {
          name: "خيط ذهبي",
          category: "خيوط",
          quantity: 12,
          cost: 100,
          value: 1200,
          status: "متوفر",
        },
        { name: "قماش", category: "أقمشة", quantity: 3, cost: 200, value: 600, status: "منخفض" },
      ],
    }),
  );

  const table = section(document, "الكميات المتبقية");
  assert.deepEqual(table.foot, ["الإجمالي", "", 15, "", "5,000", ""]);
  assert.match(document.footNotes?.join(" ") ?? "", /إدخال/);
});

test("تبويب كشف الحساب يعرض الرصيد المتراكم والمدين والدائن", () => {
  const document = buildReportDocument(
    baseInput({
      tab: "party",
      partyLabel: "عميل أ",
      partyBalance: 150,
      partyRows: [
        { date: "2026-09-02", description: "فاتورة خدمة", debit: 300, credit: 0, running: 300 },
        { date: "2026-09-04", description: "سند قبض", debit: 0, credit: 150, running: 150 },
      ],
    }),
  );

  assert.equal(document.subtitle, "عميل أ");
  const table = section(document, "الحركة التفصيلية");
  assert.equal(table.rows?.[1]?.[4], "150");
  assert.equal(table.foot?.[2], "300");
  assert.equal(table.foot?.[3], "150");
});

test("حد الصفوف يحمي الطبعات الطويلة ويوضّح الإجمالي الحقيقي", () => {
  const invoices = Array.from({ length: REPORT_ROW_LIMIT + 30 }, (_unused, index) => ({
    number: `S-${index + 1}`,
    date: "2026-09-02",
    party: "عميل",
    status: "نقدي",
    total: 10,
    paid: 10,
  }));

  const document = buildReportDocument(baseInput({ tab: "sales", invoices }));
  const table = section(document, "الفواتير");

  assert.equal(table.rows?.length, REPORT_ROW_LIMIT);
  assert.match(table.subtitle ?? "", new RegExp(`أول ${REPORT_ROW_LIMIT} سجل`));
  assert.match(table.subtitle ?? "", new RegExp(`إجمالي ${REPORT_ROW_LIMIT + 30}`));
});

test("تبويب العمليات يطبع سجل التدقيق كاملًا بعمود الحالة", () => {
  const document = buildReportDocument(
    baseInput({
      tab: "activity",
      activity: [
        { date: "2026-09-02", summary: "إنشاء فاتورة خدمة", entity: "invoices", status: "نجحت" },
      ],
    }),
  );

  const table = section(document, "سجل العمليات");
  assert.equal(table.columns?.length, 4);
  assert.deepEqual(table.rows?.[0], ["2026-09-02", "إنشاء فاتورة خدمة", "invoices", "نجحت"]);
});
