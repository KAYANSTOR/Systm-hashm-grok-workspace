import type { Invoice, InvoiceSalesType } from "@/lib/types";

/**
 * تسميات حقول الفاتورة الديناميكية — مصدر واحد للنموذج والطباعة.
 * تعتمد على نوع الفاتورة (مبيعات / مشتريات) ونوع البيع (بضاعة / خدمة تطريز / صرف مخزني).
 */
export type InvoiceFieldLabels = {
  /** عنوان الشارة المطبوعة */
  title: string;
  /** عنوان نافذة النموذج */
  formTitle: string;
  /** تسمية الطرف في الطباعة */
  partyPrintLabel: string;
  /** لاحقة الطرف */
  partySuffix: string;
  /** تسمية الطرف في النموذج */
  partyFieldLabel: string;
  /** عنوان قسم البنود */
  itemsSectionTitle: string;
  /** وصف قسم البنود */
  itemsSectionHint: string;
  /** تسمية عمود البيان */
  descriptionColumn: string;
  /** إظهار أعمدة طاقة/وار/فرشات */
  showEmbroideryQtyCols: boolean;
  /** تسميات مجاميع الطباعة */
  totalInvoiceLabel: string;
  previousBalanceLabel: string;
  grandTotalLabel: string;
  /** نص إقرار الاستلام */
  acknowledgment: string;
  /** توقيع يسار */
  signLeft: string;
  /** توقيع يمين */
  signRight: string;
};

type Kind = "sale" | "purchase";

function resolveSalesType(invoice: Pick<Invoice, "invoiceType" | "type">): InvoiceSalesType | undefined {
  if (invoice.type === "purchase") return undefined;
  return invoice.invoiceType || "PRODUCT_SALE";
}

export function invoiceFieldLabels(
  kind: Kind,
  salesType?: InvoiceSalesType | null,
): InvoiceFieldLabels {
  if (kind === "purchase") {
    return {
      title: "فاتورة مشتريات",
      formTitle: "فاتورة مشتريات",
      partyPrintLabel: "المورد :",
      partySuffix: "المحترمون",
      partyFieldLabel: "المورد",
      itemsSectionTitle: "بنود المشتريات",
      itemsSectionHint: "أضف الأصناف والكميات وأسعار الشراء",
      descriptionColumn: "البيان",
      showEmbroideryQtyCols: false,
      totalInvoiceLabel: "اجمالي الفاتورة",
      previousBalanceLabel: "الرصيد السابق",
      grandTotalLabel: "الاجمالي الكلي",
      acknowledgment:
        "أقر أنا المورد باستلام المبلغ المذكور أعلاه وأتعهد بصحة البيانات الواردة في هذه الفاتورة.",
      signLeft: "توقيع المستلم",
      signRight: "الختم والتوقيع",
    };
  }

  if (salesType === "SERVICE") {
    return {
      title: "فاتورة مبيعات",
      formTitle: "فاتورة خدمة تطريز",
      partyPrintLabel: "المطلوب من الأخ :",
      partySuffix: "المحترمون",
      partyFieldLabel: "العميل",
      itemsSectionTitle: "بنود خدمة التطريز",
      itemsSectionHint:
        "اختر نوع الوحدة (طاقة / وار / فرشات) ثم العدد والسعر — الإجمالي يُحسب تلقائيًا",
      descriptionColumn: "البيان",
      showEmbroideryQtyCols: true,
      totalInvoiceLabel: "اجمالي الفاتورة",
      previousBalanceLabel: "الرصيد السابق",
      grandTotalLabel: "الاجمالي الكلي",
      acknowledgment:
        "أقر أنا الموقع أدناه باستلام البضاعة/الخدمة المذكورة أعلاه وأتعهد بسداد المبلغ المتبقي حسب الاتفاق.",
      signLeft: "توقيع المستلم",
      signRight: "الختم والتوقيع",
    };
  }

  if (salesType === "ISSUE") {
    return {
      title: "فاتورة صرف مخزني",
      formTitle: "فاتورة صرف مخزني",
      partyPrintLabel: "المطلوب من الأخ :",
      partySuffix: "المحترمون",
      partyFieldLabel: "الجهة",
      itemsSectionTitle: "بنود الصرف",
      itemsSectionHint: "أصناف الصرف من المخزون",
      descriptionColumn: "البيان",
      showEmbroideryQtyCols: false,
      totalInvoiceLabel: "اجمالي الفاتورة",
      previousBalanceLabel: "الرصيد السابق",
      grandTotalLabel: "الاجمالي الكلي",
      acknowledgment: "أقر باستلام الأصناف المذكورة أعلاه من المخزن.",
      signLeft: "توقيع المستلم",
      signRight: "أمين المخزن",
    };
  }

  return {
    title: "فاتورة مبيعات",
    formTitle: "فاتورة مبيعات",
    partyPrintLabel: "المطلوب من الأخ :",
    partySuffix: "المحترمون",
    partyFieldLabel: "العميل",
    itemsSectionTitle: "بنود الفاتورة",
    itemsSectionHint: "أضف الأصناف والكميات وأسعار البيع",
    descriptionColumn: "البيان",
    showEmbroideryQtyCols: true,
    totalInvoiceLabel: "اجمالي الفاتورة",
    previousBalanceLabel: "الرصيد السابق",
    grandTotalLabel: "الاجمالي الكلي",
    acknowledgment:
      "أقر أنا الموقع أدناه باستلام البضاعة/الخدمة المذكورة أعلاه وأتعهد بسداد المبلغ المتبقي حسب الاتفاق.",
    signLeft: "توقيع المستلم",
    signRight: "الختم والتوقيع",
  };
}

/** اختصار من كائن الفاتورة مباشرة. */
export function invoiceFieldLabelsFromInvoice(invoice: Invoice): InvoiceFieldLabels {
  const kind: Kind = invoice.type === "purchase" ? "purchase" : "sale";
  return invoiceFieldLabels(kind, resolveSalesType(invoice));
}
