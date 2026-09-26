import type { VoucherType } from "@/lib/types";

/**
 * تسميات حقول السند الديناميكية — مصدر واحد للنموذج والطباعة.
 * تطابق المسميات الرسمية في سند القبض/الصرف.
 */
export type VoucherFieldLabels = {
  /** عنوان السند المطبوع والنموذج */
  title: string;
  /** تسمية الطرف في النموذج */
  partyFieldLabel: string;
  /** تسمية الطرف في الطباعة (مع الشرطة المائلة) */
  partyPrintLabel: string;
  /** لاحقة الطرف (المحترم) */
  partySuffix: string;
  /** تسمية المبلغ في النموذج */
  amountFieldLabel: string;
  /** عنوان قسم المبلغ */
  amountSectionTitle: string;
  /** تسمية المبلغ في الطباعة */
  amountPrintLabel: string;
  /** تسمية طريقة الدفع */
  paymentMethodLabel: string;
  /** تسمية تاريخ طريقة الدفع */
  paymentDateLabel: string;
  /** تسمية البيان / وذلك مقابل */
  descriptionLabel: string;
  /** placeholder للبيان */
  descriptionPlaceholder: string;
  /** تسمية الرصيد بعد السند */
  balanceAfterLabel: string;
  /** تسمية توقيع الطرف الأول */
  signLeft: string;
  /** تسمية توقيع الطرف الثاني */
  signRight: string;
  /** بادئة البيان التلقائي عند الحفظ */
  autoDescriptionPrefix: (partyName: string) => string;
};

const RECEIPT: VoucherFieldLabels = {
  title: "سند قبض",
  partyFieldLabel: "استلمنا من الأخ",
  partyPrintLabel: "استلمنا من الأخ /",
  partySuffix: "المحترم",
  amountFieldLabel: "المبلغ المقبوض",
  amountSectionTitle: "المبلغ المقبوض",
  amountPrintLabel: "مبلغ وقدره /",
  paymentMethodLabel: "طريقة الدفع /",
  paymentDateLabel: "بتاريخ /",
  descriptionLabel: "وذلك مقابل /",
  descriptionPlaceholder: "مثال: دفعة على حساب تطريز 200 قطعة",
  balanceAfterLabel: "الباقي له بعد هذا السند /",
  signLeft: "توقيع المستلم",
  signRight: "أمين الصندوق",
  autoDescriptionPrefix: (name) => `قبض من ${name || "جهة أخرى"}`,
};

const PAYMENT: VoucherFieldLabels = {
  title: "سند صرف",
  partyFieldLabel: "صرفنا إلى الأخ",
  partyPrintLabel: "صرفنا إلى الأخ /",
  partySuffix: "المحترم",
  amountFieldLabel: "المبلغ المصروف",
  amountSectionTitle: "المبلغ المصروف",
  amountPrintLabel: "مبلغ وقدره /",
  paymentMethodLabel: "طريقة الدفع /",
  paymentDateLabel: "بتاريخ /",
  descriptionLabel: "وذلك مقابل /",
  descriptionPlaceholder: "مثال: سداد دفعة لمورد الخيوط",
  balanceAfterLabel: "الباقي عليه بعد هذا السند /",
  signLeft: "توقيع المستلم",
  signRight: "أمين الصندوق",
  autoDescriptionPrefix: (name) => `صرف إلى ${name || "جهة أخرى"}`,
};

const DEFERRED: VoucherFieldLabels = {
  title: "سند آجل",
  partyFieldLabel: "الطرف",
  partyPrintLabel: "الطرف /",
  partySuffix: "المحترم",
  amountFieldLabel: "المبلغ",
  amountSectionTitle: "المبلغ",
  amountPrintLabel: "مبلغ وقدره /",
  paymentMethodLabel: "طريقة الدفع /",
  paymentDateLabel: "بتاريخ /",
  descriptionLabel: "وذلك مقابل /",
  descriptionPlaceholder: "سبب السند الآجل",
  balanceAfterLabel: "الرصيد بعد السند /",
  signLeft: "توقيع المستلم",
  signRight: "أمين الصندوق",
  autoDescriptionPrefix: (name) => `سند آجل — ${name || "جهة أخرى"}`,
};

const JOURNAL: VoucherFieldLabels = {
  title: "سند قيد",
  partyFieldLabel: "الطرف",
  partyPrintLabel: "الطرف /",
  partySuffix: "",
  amountFieldLabel: "المبلغ",
  amountSectionTitle: "المبلغ",
  amountPrintLabel: "مبلغ وقدره /",
  paymentMethodLabel: "طريقة الدفع /",
  paymentDateLabel: "بتاريخ /",
  descriptionLabel: "وذلك مقابل /",
  descriptionPlaceholder: "بيان القيد",
  balanceAfterLabel: "الرصيد بعد السند /",
  signLeft: "توقيع المحاسب",
  signRight: "المدير",
  autoDescriptionPrefix: (name) => `قيد — ${name || "بدون طرف"}`,
};

const BY_TYPE: Record<VoucherType, VoucherFieldLabels> = {
  receipt: RECEIPT,
  payment: PAYMENT,
  deferred: DEFERRED,
  journal: JOURNAL,
};

/** تسميات حقول السند حسب النوع — للنموذج والطباعة معًا. */
export function voucherFieldLabels(type: VoucherType): VoucherFieldLabels {
  return BY_TYPE[type] ?? JOURNAL;
}
