/**
 * محرّك التقارير — دوال نقية بلا I/O ولا React.
 * ---------------------------------------------------
 * كل رقم يُحسب من مصادر الحقيقة القائمة: الفواتير المعتمدة، بنودها، والقيود.
 * لا تحتفظ هذه الدوال بأي حالة، فتُختبر مباشرة (انظر `reporting.test.ts`).
 *
 * اتفاقيات المشروع المتبعة هنا:
 *  - العميل: المتبقي عليه = `remainingAmount` في الفاتورة.
 *  - المورد: لا أعمار ديون في هذه الوحدة (تُحسب أعمار الديون للعملاء فقط لأن
 *    ملف الموردين هنا يُسوّى عبر سندات الصرف والمشتريات مباشرة).
 *  - التكلفة «تقديرية» دائمًا لأنها من سعر تكلفة المادة في بطاقة الصنف لا من
 *    دفتر تكلفة لحظي.
 */
import type { Invoice, InventoryItem, Transaction } from "../lib/types.ts";

/** شرائح الأعمار القياسية: 30 / 60 / 90 وأكثر. */
export type AgingBucketKey = "current" | "d30" | "d60" | "d90";

export const AGING_BUCKETS: { key: AgingBucketKey; label: string }[] = [
  { key: "current", label: "0–30 يوم" },
  { key: "d30", label: "31–60 يوم" },
  { key: "d60", label: "61–90 يوم" },
  { key: "d90", label: "أكثر من 90 يوم" },
];

const DAY_MS = 86_400_000;

/** عدد الأيام بين تاريخين ISO (صفر إن كان التاريخ غير صالح). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(String(from).slice(0, 10));
  const b = new Date(String(to).slice(0, 10));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function agingBucketFor(days: number): AgingBucketKey {
  if (days <= 30) return "current";
  if (days <= 60) return "d30";
  if (days <= 90) return "d60";
  return "d90";
}

export type AgingPartyRow = {
  partyId: string;
  total: number;
  oldestDays: number;
  buckets: Record<AgingBucketKey, number>;
};

export type AgingResult = {
  buckets: Record<AgingBucketKey, number>;
  total: number;
  byParty: AgingPartyRow[];
};

export function emptyAging(): Record<AgingBucketKey, number> {
  return { current: 0, d30: 0, d60: 0, d90: 0 };
}

/**
 * أعمار الديون على العملاء: تُوزَّع **الفواتير غير المسددة** على شرائح عمرية
 * حسب تاريخ الفاتورة و`remainingAmount` المتبقي عليها.
 */
export function receivableAging(
  invoices: Invoice[],
  asOf: string,
): AgingResult {
  const totals = emptyAging();
  const byParty = new Map<string, AgingPartyRow>();

  for (const invoice of invoices) {
    if (invoice.type !== "sale") continue;
    if (!invoice.isApproved || invoice.isCancelled) continue;
    const remaining = Number(invoice.remainingAmount) || 0;
    if (remaining <= 0.000001) continue;

    const days = daysBetween(invoice.date, asOf);
    const bucket = agingBucketFor(days);
    totals[bucket] += remaining;

    const row = byParty.get(invoice.partyId) ?? {
      partyId: invoice.partyId,
      total: 0,
      oldestDays: 0,
      buckets: emptyAging(),
    };
    row.total += remaining;
    row.buckets[bucket] += remaining;
    row.oldestDays = Math.max(row.oldestDays, Math.max(0, days));
    byParty.set(invoice.partyId, row);
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return {
    buckets: totals,
    total,
    byParty: [...byParty.values()].sort((a, b) => b.total - a.total),
  };
}

export type ProductMovementRow = {
  productId: string;
  name: string;
  inQty: number;
  outQty: number;
  netQty: number;
  documents: number;
};

/**
 * الأصناف الأكثر حركة: تُستخرج من بنود الفواتير المعتمدة.
 * `inQty` = وارد (مشتريات/توريد)، `outQty` = صادر (بيع أو صرف مخزني).
 */
export function productMovement(
  invoices: Invoice[],
  options?: { from?: string; to?: string },
): ProductMovementRow[] {
  const from = options?.from;
  const to = options?.to;
  const byProduct = new Map<string, ProductMovementRow>();

  for (const invoice of invoices) {
    if (!invoice.isApproved || invoice.isCancelled) continue;
    const date = String(invoice.date).slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;

    for (const line of invoice.items) {
      const productId = line.inventoryItemId;
      if (!productId || productId === "SERVICE") continue;
      const quantity = Number(line.quantity) || 0;
      if (quantity === 0) continue;

      const row = byProduct.get(productId) ?? {
        productId,
        name: line.name || productId,
        inQty: 0,
        outQty: 0,
        netQty: 0,
        documents: 0,
      };
      if (invoice.type === "purchase") row.inQty += quantity;
      else row.outQty += quantity;
      row.netQty = row.inQty - row.outQty;
      row.documents += 1;
      byProduct.set(productId, row);
    }
  }

  return [...byProduct.values()].sort(
    (a, b) => b.outQty + b.inQty - (a.outQty + a.inQty),
  );
}

export type ProfitResult = {
  serviceRevenue: number;
  productRevenue: number;
  totalRevenue: number;
  estimatedCost: number;
  grossProfit: number;
  marginPercent: number;
  estimated: true;
};

/**
 * أرباح تقديرية: إيراد خدمة التطريز بلا تكلفة مباشرة مسجّلة + إيراد بضاعة
 * ناقص تكلفة البنود (سعر تكلفة بطاقة الصنف). القيمة **تقديرية** دائمًا.
 */
export function estimatedProfit(
  invoices: Invoice[],
  products: Pick<InventoryItem, "id" | "costPrice">[],
  options?: { from?: string; to?: string },
): ProfitResult {
  const costByProduct = new Map(products.map((p) => [p.id, Number(p.costPrice) || 0]));
  const from = options?.from;
  const to = options?.to;

  let serviceRevenue = 0;
  let productRevenue = 0;
  let estimatedCost = 0;

  for (const invoice of invoices) {
    if (invoice.type !== "sale" || !invoice.isApproved || invoice.isCancelled) continue;
    const date = String(invoice.date).slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;

    const isService = invoice.invoiceType === "SERVICE";
    const isIssue = invoice.invoiceType === "ISSUE";
    if (isIssue) continue; // صرف مخزني داخلي بلا إيراد

    if (isService) {
      serviceRevenue += Number(invoice.total) || 0;
      continue;
    }

    productRevenue += Number(invoice.total) || 0;
    for (const line of invoice.items) {
      const productId = line.inventoryItemId;
      if (!productId || productId === "SERVICE") continue;
      const unitCost = costByProduct.get(productId) ?? 0;
      estimatedCost += unitCost * (Number(line.quantity) || 0);
    }
  }

  const totalRevenue = serviceRevenue + productRevenue;
  const grossProfit = totalRevenue - estimatedCost;
  return {
    serviceRevenue,
    productRevenue,
    totalRevenue,
    estimatedCost,
    grossProfit,
    marginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    estimated: true,
  };
}

export type CashFlowResult = {
  in: number;
  out: number;
  net: number;
  byMethod: { method: string; in: number; out: number }[];
};

/** حركة الصندوق في فترة: إجمالي داخل/خارج + تفصيل حسب طريقة الدفع. */
export function cashFlow(
  transactions: Transaction[],
  options?: { from?: string; to?: string },
): CashFlowResult {
  const from = options?.from;
  const to = options?.to;
  const byMethod = new Map<string, { method: string; in: number; out: number }>();
  let totalIn = 0;
  let totalOut = 0;

  for (const transaction of transactions) {
    const cashIn = Number(transaction.cashIn) || 0;
    const cashOut = Number(transaction.cashOut) || 0;
    if (cashIn === 0 && cashOut === 0) continue;
    const date = String(transaction.date).slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;

    totalIn += cashIn;
    totalOut += cashOut;
    const method = transaction.paymentMethod || "cash";
    const row = byMethod.get(method) ?? { method, in: 0, out: 0 };
    row.in += cashIn;
    row.out += cashOut;
    byMethod.set(method, row);
  }

  return {
    in: totalIn,
    out: totalOut,
    net: totalIn - totalOut,
    byMethod: [...byMethod.values()].sort((a, b) => b.in + b.out - (a.in + a.out)),
  };
}
