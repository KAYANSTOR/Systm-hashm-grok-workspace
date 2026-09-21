import type { Invoice } from "../lib/types.ts";

/**
 * قيود الفاتورة المعتمدة على دفتر القيود — مصدر حقيقة واحد.
 * ------------------------------------------------------------
 * كانت هذه القيود مكتوبة يدويًا داخل `server/repository.ts` (وفي مسار مزامنة
 * البيانات القديمة) وأنقصت قيدًا واحدًا: أثر المبلغ المدفوع على **ذمة الطرف**.
 * النتيجة كانت أن رصيد العميل/المورد بعد كل جلب من الخادم يساوي إجمالي
 * الفاتورة ولا يراعي المدفوع، بخلاف الرصيد المعروض لحظة الحفظ.
 *
 * القاعدة الآن لكل فاتورة معتمدة:
 *   1) `_party`  → ذمة الطرف بإجمالي الفاتورة (مدين للعميل، دائن للمورد).
 *   2) `_pay`    → الصندوق بالمبلغ المدفوع (زيادة عند البيع، نقص عند الشراء).
 *   3) `_settle` → تسوية ذمة الطرف بالمبلغ المدفوع (دائن للعميل، مدين للمورد).
 * وبذلك = رصيد الطرف الناتج عن المستند هو **المتبقي** فقط.
 *
 * ⚠️ أي تغيير هنا يجب أن تتوافق معه `migrations/0024_invoice_balance_settlement.sql`
 * (التي تُصلح البيانات القديمة) و`scripts/accounting-invariant-check.mjs`.
 */

export type LedgerRow = {
  id: string;
  accountId: string;
  partyId: string | null;
  amount: number;
  debit: number;
  credit: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
};

/** وصف المستند كما يظهر في دفتر القيود. */
export function invoiceDescription(invoice: Invoice): string {
  const isSale = invoice.type === "sale";
  if (invoice.invoiceType === "SERVICE") return "فاتورة خدمة تطريز";
  if (invoice.invoiceType === "ISSUE") return "أمر صرف مخزني";
  return isSale ? "فاتورة مبيعات" : "فاتورة مشتريات";
}

/** قيود الفاتورة على الذمة والصندوق (لا تشمل حركات المخزون). */
export function invoiceLedgerRows(invoice: Invoice): LedgerRow[] {
  if (!invoice.isApproved) return [];

  const isSale = invoice.type === "sale";
  const total = Number(invoice.total) || 0;
  const paid = Number(invoice.paidAmount) || 0;
  const partyAccount = isSale ? "accounts_receivable" : "accounts_payable";
  const createdAt = invoice.createdAt || new Date().toISOString();
  const description = invoiceDescription(invoice);

  const documentDebit = isSale ? total : 0;
  const documentCredit = isSale ? 0 : total;

  const rows: LedgerRow[] = [];

  // مستند بلا قيمة مالية (توريد أو صرف مخزني بلا أسعار) لا يُنشئ قيودًا فارغة:
  // أثره في المخزون فقط، وصفوف بقيمة صفر تُشوّش دفتر القيود والتقارير.
  if (documentDebit !== 0 || documentCredit !== 0) {
    rows.push({
      id: `${invoice.id}_party`,
      accountId: partyAccount,
      partyId: invoice.partyId,
      amount: documentDebit - documentCredit,
      debit: documentDebit,
      credit: documentCredit,
      referenceType: "invoice",
      referenceId: invoice.id,
      description,
      createdAt,
    });
  }

  if (paid > 0) {
    rows.push({
      id: `${invoice.id}_pay`,
      accountId: "cash",
      partyId: invoice.partyId,
      amount: isSale ? paid : -paid,
      debit: isSale ? paid : 0,
      credit: isSale ? 0 : paid,
      referenceType: "invoice_payment",
      referenceId: invoice.id,
      description: "سداد فاتورة",
      createdAt,
    });
    rows.push({
      id: `${invoice.id}_settle`,
      accountId: partyAccount,
      partyId: invoice.partyId,
      amount: isSale ? -paid : paid,
      debit: isSale ? 0 : paid,
      credit: isSale ? paid : 0,
      referenceType: "invoice_payment",
      referenceId: invoice.id,
      description: "سداد فاتورة",
      createdAt,
    });
  }

  return rows;
}
