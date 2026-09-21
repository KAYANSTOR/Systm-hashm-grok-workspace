import type { Transaction } from "./types";

/**
 * ملاحظة معمارية (تدقيق 21 سبتمبر 2026):
 * كان في هذا الملف **نسخة ثانية مكرّرة** من قواعد المحاسبة (`applyInvoice`,
 * `applyVoucher`, `applyExpense`) لا يستوردها ولا ينفّذها أي شاشة — النسخة
 * الحيّة الوحيدة هي `src/domain/operations.ts` (مع `src/domain/invoice-ledger-rows.ts`
 * للقيود على الخادم). وجود نسختين متباعدتين كان خطرًا محاسبيًا حقيقيًا: أي
 * إصلاح في إحداهما لا ينعكس على الأخرى، كما حدث فعلًا في قيد تسوية المدفوع.
 * لذلك حُذفت النسخة الميتة وبقي هنا ما يُستخدم فعلًا فقط.
 */

/** رصيد الصندوق المشتق من القيود (تُضاف إليه حركات السندات والفواتير والمصروفات). */
export function cashBalance(
  transactions: Transaction[],
  method?: string,
): number {
  return transactions.reduce((sum, t) => {
    if (method && (t.paymentMethod || "cash") !== method) return sum;
    return sum + (t.cashIn || 0) - (t.cashOut || 0);
  }, 0);
}
