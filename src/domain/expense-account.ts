import type { Expense } from "../lib/types.ts";

/**
 * حساب المصروف في دفتر القيود — مصدر حقيقة واحد.
 * ------------------------------------------------
 * قرار صاحب المشروع (الخيار الثاني، 21 سبتمبر 2026): كل فئة مصروف تُرحَّل إلى
 * حساب مصروف مستقل باسمها بدل تجميعها كلها على حساب «مشتريات»، فتُعرض قائمة
 * الحسابات وتقارير المصروفات بالفئات الفعلية (إيجار، كهرباء، رواتب…).
 *
 * اسم الحساب مشتق آليًا من الفئة نفسها `expense:<category>` → «مصروف <الفئة>»،
 * وأي فئة جديدة يضيفها المستخدم لاحقًا تحصل على حسابها تلقائيًا بلا تعديل كود —
 * ينشئ الخادم الحساب عند أول ترحيل (`insert into accounts on conflict do nothing`).
 */

/** حساب «مشتريات» يبقى حصريًا لفواتير المشتريات، لا للمصروفات العامة. */
export const PURCHASES_ACCOUNT_ID = "purchases";

/** معرّف حساب فئة مصروف: ثابت ومشتق من الفئة، فإعادة الترحيل لا تُكرّر الحساب. */
export function expenseAccountId(category: string): string {
  const normalized = String(category ?? "").trim();
  return `expense:${normalized || "أخرى"}`;
}

/** الاسم العربي المعروض لحساب فئة المصروف. */
export function expenseAccountName(category: string): string {
  return `مصروف ${String(category ?? "").trim() || "أخرى"}`;
}

/** حساب الترحيل لمصروف معطى (الفئة فارغة → «أخرى»). */
export function expenseAccountFor(expense: Pick<Expense, "category">): string {
  return expenseAccountId(expense.category || "أخرى");
}

/** قائمة الحسابات المشتقة من فئات المصروفات المعروفة (للتهيئة والعرض). */
export const KNOWN_EXPENSE_CATEGORIES = [
  "إيجار",
  "كهرباء",
  "رواتب",
  "صيانة",
  "نقل وشحن",
  "مستلزمات",
  "ضيافة",
  "أخرى",
] as const;
