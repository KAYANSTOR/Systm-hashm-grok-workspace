/**
 * بناء مستند التقرير القابل للطباعة — دوال نقية بلا I/O وبلا React.
 * ------------------------------------------------------------------
 * شاشة التقارير كانت تطبع نفسها بـ `window.print()` فتخرج وسط القوائم والأزرار.
 * الآن تُبنى بيانات المستند هنا (قابلة للاختبار مباشرة في `report-document.test.ts`)،
 * ويعرضها `components/print/ReportPrintTemplate.tsx` بمقاس A4 بهوية المنشأة.
 */

export type ReportTab =
  "overview" | "sales" | "cash" | "stock" | "party" | "analytics" | "activity";

export type ReportKpi = {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn" | "brand" | "muted";
};

export type ReportColumn = {
  label: string;
  width?: string;
  align?: "right" | "center";
};

export type ReportSection = {
  title: string;
  subtitle?: string;
  kpis?: ReportKpi[];
  columns?: ReportColumn[];
  rows?: Array<Array<string | number>>;
  foot?: Array<string | number>;
  emptyText?: string;
  notes?: string[];
};

export interface ReportDocumentData {
  title: string;
  subtitle?: string;
  periodFrom: string;
  periodTo: string;
  meta?: Array<{ label: string; value: string }>;
  sections: ReportSection[];
  footNotes?: string[];
}

/** حد أمان: التقارير الطويلة تُقصّ إلى هذا العدد من الصفوف مع ملاحظة واضحة. */
export const REPORT_ROW_LIMIT = 120;

export const REPORT_TAB_TITLES: Record<ReportTab, string> = {
  overview: "تقرير ملخص الحركة",
  sales: "تقرير المبيعات وخدمات التطريز",
  cash: "تقرير حركة الصندوق",
  stock: "تقرير المخزون والكميات المتبقية",
  party: "كشف حساب طرف",
  analytics: "تقرير التحليلات",
  activity: "تقرير سجل العمليات",
};

/** تنسيق مبلغ للطباعة: رقم واحد بفاصل آلاف وفاصلتين عشريتين بلا رمز عملة. */
export function reportMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export interface ReportDocumentInput {
  tab: ReportTab;
  from: string;
  to: string;
  partyLabel?: string;
  warehouseLabel?: string;

  /* ملخص */
  salesTotal: number;
  collected: number;
  receiptsTotal: number;
  expenseTotal: number;
  cashBalance: number;
  stockValue: number;
  expensesByCategory: Array<[string, number]>;
  dailySales: Array<{ date: string; total: number }>;

  /* المبيعات */
  invoices: Array<{
    number: string;
    date: string;
    party: string;
    status: string;
    total: number;
    paid: number;
  }>;

  /* الصندوق */
  cashRows: Array<{ date: string; description: string; inAmount: number; outAmount: number }>;

  /* المخزون */
  stock: Array<{
    name: string;
    category: string;
    quantity: number;
    cost: number;
    value: number;
    status: string;
  }>;

  /* كشف الحساب */
  partyRows: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    running: number;
  }>;
  partyBalance: number;

  /* التحليلات */
  agingBuckets: Array<{ key: string; label: string; amount: number }>;
  agingTotal: number;
  agingByParty: Array<{ name: string; days: number; total: number }>;
  profit: {
    serviceRevenue: number;
    productRevenue: number;
    estimatedCost: number;
    grossProfit: number;
    marginPercent: number;
  };
  movement: Array<{ name: string; inQty: number; outQty: number; netQty: number }>;
  flow: {
    in: number;
    out: number;
    net: number;
    byMethod: Array<{ label: string; inAmount: number; outAmount: number }>;
  };

  /* سجل العمليات */
  activity: Array<{ date: string; summary: string; entity: string; status: string }>;
}

function capRows<T>(rows: T[]): { rows: T[]; note?: string } {
  if (rows.length <= REPORT_ROW_LIMIT) return { rows };
  return {
    rows: rows.slice(0, REPORT_ROW_LIMIT),
    note: `يُعرض أول ${REPORT_ROW_LIMIT} سجل من إجمالي ${rows.length} — استخدم الفلاتر لتضييق الفترة عند الحاجة.`,
  };
}

/**
 * يبني مستند التقرير للتبويب المطلوب. كل الأرقام المالية تُطبع من نفس مصادر
 * الحقيقة المستخدمة على الشاشة (لا إعادة حساب ولا تقريب مختلف).
 */
export function buildReportDocument(input: ReportDocumentInput): ReportDocumentData {
  const meta: Array<{ label: string; value: string }> = [];
  if (input.partyLabel) meta.push({ label: "الطرف", value: input.partyLabel });
  if (input.warehouseLabel) meta.push({ label: "المخزن", value: input.warehouseLabel });

  const base: Omit<ReportDocumentData, "sections" | "footNotes"> = {
    title: REPORT_TAB_TITLES[input.tab],
    subtitle: input.tab === "party" && input.partyLabel ? input.partyLabel : undefined,
    periodFrom: input.from,
    periodTo: input.to,
    meta,
  };

  if (input.tab === "overview") {
    const categories = [...input.expensesByCategory].sort((a, b) => b[1] - a[1]);
    const days = input.dailySales.filter((row) => row.total > 0);
    const { rows: daysRows, note: daysNote } = capRows(days);
    return {
      ...base,
      sections: [
        {
          title: "المؤشرات الرئيسية",
          kpis: [
            {
              label: "مبيعات الفترة",
              value: `${reportMoney(input.salesTotal)} ر.ي`,
              tone: "brand",
            },
            {
              label: "المقبوض على الفواتير",
              value: `${reportMoney(input.collected)} ر.ي`,
              tone: "good",
            },
            {
              label: "سندات القبض",
              value: `${reportMoney(input.receiptsTotal)} ر.ي`,
              tone: "good",
            },
            { label: "المصروفات", value: `${reportMoney(input.expenseTotal)} ر.ي`, tone: "bad" },
            { label: "رصيد الصندوق (من القيود)", value: `${reportMoney(input.cashBalance)} ر.ي` },
            { label: "قيمة المخزون بالتكلفة", value: `${reportMoney(input.stockValue)} ر.ي` },
          ],
        },
        {
          title: "المصروفات حسب الفئة",
          subtitle: `إجمالي ${reportMoney(input.expenseTotal)} ر.ي`,
          columns: [
            { label: "الفئة", align: "right", width: "60%" },
            { label: "المبلغ", width: "40%" },
          ],
          rows: categories.map(([name, amount]) => [name, reportMoney(amount)]),
          emptyText: "لا مصروفات في الفترة",
        },
        {
          title: "المبيعات اليومية",
          subtitle: daysNote ?? `${days.length} يوم فيه حركة`,
          columns: [
            { label: "التاريخ", width: "40%" },
            { label: "المبيعات", width: "60%" },
          ],
          rows: daysRows.map((row) => [row.date, reportMoney(row.total)]),
          foot: days.length ? ["الإجمالي", reportMoney(input.salesTotal)] : undefined,
          emptyText: "لا مبيعات في الفترة",
        },
      ],
    };
  }

  if (input.tab === "sales") {
    const { rows, note } = capRows(input.invoices);
    return {
      ...base,
      sections: [
        {
          title: "الفواتير",
          subtitle: note ?? `${input.invoices.length} فاتورة`,
          columns: [
            { label: "الرقم", width: "16%" },
            { label: "التاريخ", width: "15%" },
            { label: "الطرف", align: "right", width: "27%" },
            { label: "الحالة", width: "14%" },
            { label: "الإجمالي", width: "14%" },
            { label: "المدفوع", width: "14%" },
          ],
          rows: rows.map((row) => [
            row.number,
            row.date,
            row.party,
            row.status,
            reportMoney(row.total),
            reportMoney(row.paid),
          ]),
          foot: input.invoices.length
            ? [
                "الإجمالي",
                "",
                "",
                "",
                reportMoney(input.invoices.reduce((sum, row) => sum + row.total, 0)),
                reportMoney(input.invoices.reduce((sum, row) => sum + row.paid, 0)),
              ]
            : undefined,
          emptyText: "لا فواتير في الفترة",
        },
      ],
    };
  }

  if (input.tab === "cash") {
    const { rows, note } = capRows(input.cashRows);
    const cashIn = input.cashRows.reduce((sum, row) => sum + row.inAmount, 0);
    const cashOut = input.cashRows.reduce((sum, row) => sum + row.outAmount, 0);
    return {
      ...base,
      sections: [
        {
          title: "ملخص الصندوق",
          kpis: [
            {
              label: "رصيد الصندوق الحالي",
              value: `${reportMoney(input.cashBalance)} ر.ي`,
              tone: "brand",
            },
            { label: "إجمالي الداخل", value: `${reportMoney(cashIn)} ر.ي`, tone: "good" },
            { label: "إجمالي الخارج", value: `${reportMoney(cashOut)} ر.ي`, tone: "bad" },
            { label: "صافي الفترة", value: `${reportMoney(cashIn - cashOut)} ر.ي` },
          ],
        },
        {
          title: "حركات الصندوق",
          subtitle: note ?? `${input.cashRows.length} حركة`,
          columns: [
            { label: "التاريخ", width: "16%" },
            { label: "البيان", align: "right", width: "44%" },
            { label: "داخل", width: "20%" },
            { label: "خارج", width: "20%" },
          ],
          rows: rows.map((row) => [
            row.date,
            row.description,
            row.inAmount ? reportMoney(row.inAmount) : "—",
            row.outAmount ? reportMoney(row.outAmount) : "—",
          ]),
          foot: input.cashRows.length
            ? ["الإجمالي", "", reportMoney(cashIn), reportMoney(cashOut)]
            : undefined,
          emptyText: "لا حركة صندوق في الفترة",
        },
      ],
    };
  }

  if (input.tab === "stock") {
    const { rows, note } = capRows(input.stock);
    const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    return {
      ...base,
      sections: [
        {
          title: "الكميات المتبقية",
          subtitle: note ?? `${input.stock.length} صنف`,
          columns: [
            { label: "الصنف", align: "right", width: "32%" },
            { label: "الفئة", width: "16%" },
            { label: "المتبقي", width: "12%" },
            { label: "سعر التكلفة", width: "14%" },
            { label: "القيمة", width: "14%" },
            { label: "الحالة", width: "12%" },
          ],
          rows: rows.map((row) => [
            row.name,
            row.category,
            row.quantity,
            reportMoney(row.cost),
            reportMoney(row.value),
            row.status,
          ]),
          foot: input.stock.length
            ? ["الإجمالي", "", quantity, "", reportMoney(input.stockValue), ""]
            : undefined,
          emptyText: "لا أصناف مطابقة",
        },
      ],
      footNotes: [
        "الكمية المتبقية محسوبة من دفتر حركة المخزون (إدخال − إخراج)، وقيمة المخزون بسعر التكلفة المسجّل في بطاقة الصنف.",
      ],
    };
  }

  if (input.tab === "party") {
    const { rows, note } = capRows(input.partyRows);
    const debit = rows.reduce((sum, row) => sum + row.debit, 0);
    const credit = rows.reduce((sum, row) => sum + row.credit, 0);
    return {
      ...base,
      sections: [
        {
          title: "ملخص الحساب",
          kpis: [
            {
              label: "الرصيد الحالي",
              value: `${reportMoney(input.partyBalance)} ر.ي`,
              tone: input.partyBalance > 0 ? "bad" : "good",
            },
            { label: "إجمالي المدين", value: `${reportMoney(debit)} ر.ي` },
            { label: "إجمالي الدائن", value: `${reportMoney(credit)} ر.ي` },
            { label: "عدد الحركات", value: String(input.partyRows.length) },
          ],
        },
        {
          title: "الحركة التفصيلية",
          subtitle: note ?? `${input.partyRows.length} حركة`,
          columns: [
            { label: "التاريخ", width: "15%" },
            { label: "البيان", align: "right", width: "39%" },
            { label: "مدين", width: "15%" },
            { label: "دائن", width: "15%" },
            { label: "الرصيد المتراكم", width: "16%" },
          ],
          rows: rows.map((row) => [
            row.date,
            row.description,
            row.debit ? reportMoney(row.debit) : "—",
            row.credit ? reportMoney(row.credit) : "—",
            reportMoney(row.running),
          ]),
          foot: input.partyRows.length
            ? ["الإجمالي", "", reportMoney(debit), reportMoney(credit), ""]
            : undefined,
          emptyText: "لا حركات على هذا الحساب",
        },
      ],
    };
  }

  if (input.tab === "analytics") {
    const { buckets } = input.agingBuckets.length
      ? { buckets: input.agingBuckets }
      : { buckets: [] as Array<{ key: string; label: string; amount: number }> };
    return {
      ...base,
      sections: [
        {
          title: "أعمار الديون (المتبقي على العملاء)",
          subtitle: `الإجمالي ${reportMoney(input.agingTotal)} ر.ي`,
          columns: [
            { label: "الشريحة", align: "right", width: "60%" },
            { label: "المبلغ", width: "40%" },
          ],
          rows: buckets.map((bucket) => [bucket.label, reportMoney(bucket.amount)]),
          foot: buckets.length ? ["الإجمالي", reportMoney(input.agingTotal)] : undefined,
          emptyText: "لا ديون مفتوحة",
        },
        {
          title: "أكبر المدينين",
          columns: [
            { label: "العميل", align: "right", width: "60%" },
            { label: "أقدم دين (يوم)", width: "20%" },
            { label: "المتبقي", width: "20%" },
          ],
          rows: input.agingByParty.map((row) => [row.name, row.days, reportMoney(row.total)]),
          emptyText: "لا مدينين",
        },
        {
          title: "أرباح الفترة (تقديرية)",
          kpis: [
            {
              label: "إيراد خدمات التطريز",
              value: `${reportMoney(input.profit.serviceRevenue)} ر.ي`,
              tone: "brand",
            },
            {
              label: "إيراد بيع البضاعة",
              value: `${reportMoney(input.profit.productRevenue)} ر.ي`,
            },
            {
              label: "التكلفة التقديرية",
              value: `${reportMoney(input.profit.estimatedCost)} ر.ي`,
              tone: "warn",
            },
            {
              label: "الربح التقديري",
              value: `${reportMoney(input.profit.grossProfit)} ر.ي`,
              tone: "good",
            },
            { label: "هامش الربح %", value: `${input.profit.marginPercent.toFixed(1)}%` },
          ],
          notes: ["التكلفة مأخوذة من سعر التكلفة في بطاقة الصنف، وليست تكلفة لحظية من دفتر تكلفة."],
        },
        {
          title: "الأصناف الأكثر حركة",
          columns: [
            { label: "الصنف", align: "right", width: "49%" },
            { label: "وارد", width: "17%" },
            { label: "صادر", width: "17%" },
            { label: "الصافي", width: "17%" },
          ],
          rows: input.movement.map((row) => [row.name, row.inQty, row.outQty, row.netQty]),
          emptyText: "لا حركة أصناف في الفترة",
        },
        {
          title: "حركة الصندوق حسب طريقة الدفع",
          subtitle: `داخل ${reportMoney(input.flow.in)} ر.ي · خارج ${reportMoney(input.flow.out)} ر.ي · الصافي ${reportMoney(input.flow.net)} ر.ي`,
          columns: [
            { label: "طريقة الدفع", align: "right", width: "40%" },
            { label: "داخل", width: "30%" },
            { label: "خارج", width: "30%" },
          ],
          rows: input.flow.byMethod.map((row) => [
            row.label,
            reportMoney(row.inAmount),
            reportMoney(row.outAmount),
          ]),
          emptyText: "لا حركة صندوق في الفترة",
        },
      ],
    };
  }

  const { rows, note } = capRows(input.activity);
  return {
    ...base,
    sections: [
      {
        title: "سجل العمليات",
        subtitle: note ?? `${input.activity.length} عملية`,
        columns: [
          { label: "التاريخ", width: "16%" },
          { label: "العملية", align: "right", width: "46%" },
          { label: "الكيان", width: "24%" },
          { label: "الحالة", width: "14%" },
        ],
        rows: rows.map((row) => [row.date, row.summary, row.entity, row.status]),
        emptyText: "لا سجلات في الفترة",
      },
    ],
  };
}
