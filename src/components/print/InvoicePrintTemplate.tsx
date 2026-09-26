import { CheckCircle2 } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { useStore } from "@/lib/store";
import PrintPreview from "./PrintPreview";

interface InvoicePrintTemplateProps {
  invoice: Invoice;
  partyName: string;
  onClose: () => void;
}

function money(value: number): string {
  return formatMoney(Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

function invoiceTitle(invoice: Invoice): string {
  if (invoice.invoiceType === "SERVICE") return "فاتورة مبيعات";
  if (invoice.invoiceType === "ISSUE") return "فاتورة صرف مخزني";
  if (invoice.type === "purchase") return "فاتورة مشتريات";
  return "فاتورة مبيعات";
}

/**
 * فاتورة A4 — تصميم مطابق للنموذج الرسمي (Navy + Gold).
 * البيانات والحسابات من النظام؛ القالب طبقة عرض فقط.
 */
export default function InvoicePrintTemplate({
  invoice,
  partyName,
  onClose,
}: InvoicePrintTemplateProps) {
  const { customers, suppliers, approveInvoice, settings, organization } = useStore();

  const party =
    invoice.type === "sale"
      ? customers.find((c) => c.id === invoice.partyId)
      : suppliers.find((s) => s.id === invoice.partyId);

  const companyName =
    organization.name || settings.name || "معامل هاشم الأحمدي للتصميم والتطريز الإلكتروني";
  const companyAddress =
    organization.address || settings.location || "صنعاء - شارع الزبيري - مقابل وزارة الدفاع";
  const companyPhones =
    organization.phone ||
    [settings.phone1, settings.phone2].filter(Boolean).join(" - ") ||
    "770 447 441 - 730 447 441";
  const logoSrc = organization.logo || "/logo-hashm.jpg";

  const subTotal = invoice.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const discount = Math.max(0, Number(invoice.discount) || 0);
  const total = Math.max(0, subTotal - discount);
  const paid = Math.max(0, Number(invoice.paidAmount) || 0);
  const remaining = Math.max(0, total - paid);

  const currentBalance = Number(party?.balance) || 0;
  const previousBalance = invoice.isApproved
    ? invoice.type === "sale"
      ? currentBalance - remaining
      : currentBalance + remaining
    : currentBalance;
  const grandTotal = previousBalance + total;

  const isCash = invoice.paymentType === "cash";
  const isDeferred = invoice.paymentType === "deferred";
  const isPartial = invoice.paymentType === "partial";

  const minRows = 5;
  const emptyRows = Math.max(0, minRows - invoice.items.length);

  const stamp = invoice.isCancelled
    ? { label: "ملغاة", tone: "doc-stamp--cancelled" }
    : !invoice.isApproved
      ? { label: "مسودة", tone: "doc-stamp--draft" }
      : null;

  return (
    <PrintPreview
      title="معاينة الفاتورة قبل الطباعة"
      subtitle={`${invoiceTitle(invoice)} · ${partyName}`}
      paper="a4"
      fileName={`فاتورة_${invoice.invoiceNumber}`}
      shareText={`فاتورة ${invoice.invoiceNumber} — ${partyName}`}
      onClose={onClose}
      extraAction={
        !invoice.isApproved && !invoice.isCancelled ? (
          <button
            type="button"
            className="print-btn print-btn--primary"
            onClick={async () => {
              const ok = await approveInvoice(invoice.id);
              if (ok) onClose();
            }}
          >
            <CheckCircle2 className="size-4" />
            <span>اعتماد الفاتورة</span>
          </button>
        ) : undefined
      }
    >
      <header className="doc-head">
        <div className="doc-head__copy">
          <h1 className="doc-head__name">{companyName}</h1>
          <div className="doc-head__meta">{companyAddress}</div>
          <div className="doc-head__phones">☎ {companyPhones}</div>
        </div>
        <div className="doc-head__logo">
          <img src={logoSrc} alt="شعار المنشأة" />
        </div>
      </header>

      {stamp ? <span className={`doc-stamp ${stamp.tone}`}>{stamp.label}</span> : null}

      <div className="inv-band">
        <div className="inv-band__title">فاتورة مبيعات</div>
        <div className="inv-band__meta">
          <div className="inv-meta-row">
            <span>الرقم:</span>
            <strong dir="ltr">{invoice.invoiceNumber}</strong>
          </div>
          <div className="inv-meta-row">
            <span>التاريخ:</span>
            <strong dir="ltr">{formatDate(invoice.date)}</strong>
          </div>
        </div>
      </div>

      <div className="inv-pay-row">
        <span className="inv-pay-label">فاتورة</span>
        <span className={`inv-opt ${isCash ? "is-on" : ""}`}>
          <i />
          نقداً
        </span>
        <span className={`inv-opt ${isDeferred ? "is-on" : ""}`}>
          <i />
          أجل
        </span>
        {isPartial ? (
          <span className="inv-opt is-on">
            <i />
            جزئي
          </span>
        ) : null}
      </div>

      <div className="inv-party">
        <div className="inv-party__line">
          <span>المطلوب من الأخ :</span>
          <strong>{partyName || "عميل نقدي"}</strong>
        </div>
        <div className="inv-party__line">
          <span>المحترمون</span>
          <strong />
        </div>
      </div>

      <section className="doc-table-wrap">
        <table className="doc-table inv-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-index">
                رقم البند
              </th>
              <th rowSpan={2}>البيان</th>
              <th colSpan={3}>الكمية</th>
              <th rowSpan={2}>سعر الوحدة</th>
              <th rowSpan={2}>القيمة الاجمالية</th>
            </tr>
            <tr>
              <th className="sub-qty">طاقة</th>
              <th className="sub-qty">وار</th>
              <th className="sub-qty">فرشات</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id || index}>
                <td className="col-index">{String(index + 1).padStart(2, "0")}</td>
                <td className="col-desc">{item.name || "—"}</td>
                <td className="col-number">—</td>
                <td className="col-number">—</td>
                <td className="col-number">—</td>
                <td className="col-number">{money(item.unitPrice)}</td>
                <td className="col-number">{money(item.total)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`} className="doc-table__empty">
                <td className="col-index">{String(invoice.items.length + i + 1).padStart(2, "0")}</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="inv-totals">
        <div className="inv-total-row">
          <span className="inv-total-label">اجمالي الفاتورة</span>
          <span className="inv-total-value" dir="ltr">
            {money(total)}
          </span>
        </div>
        <div className="inv-total-row">
          <span className="inv-total-label">الرصيد السابق</span>
          <span className="inv-total-value" dir="ltr">
            {money(previousBalance)}
          </span>
        </div>
        <div className="inv-total-row inv-total-row--grand">
          <span className="inv-total-label">الاجمالي الكلي</span>
          <span className="inv-total-value" dir="ltr">
            {money(grandTotal)}
          </span>
        </div>
      </div>

      {discount > 0 || paid > 0 ? (
        <div className="inv-extra-totals">
          {discount > 0 ? (
            <span>
              الخصم: <strong dir="ltr">{money(discount)}</strong>
            </span>
          ) : null}
          {paid > 0 ? (
            <span>
              المدفوع: <strong dir="ltr">{money(paid)}</strong>
            </span>
          ) : null}
          {remaining > 0 ? (
            <span>
              المتبقي: <strong dir="ltr">{money(remaining)}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="inv-ack">
        إستلمت البضاعة الموضحة أعلاه كاملة ومطابقة للتفاصيل مع إلتزامي بدفع القيمة خلال فترة
        أقصاها ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ) من تحرير الفاتورة
      </div>

      <div className="doc-signs">
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المبيعات</div>
          <div className="doc-sign__line" />
        </div>
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المستلم</div>
          <div className="doc-sign__line" />
        </div>
      </div>

      <footer className="doc-foot">
        <span>
          ☎ {companyPhones} &nbsp;|&nbsp; 📍 {companyAddress}
        </span>
      </footer>
    </PrintPreview>
  );
}
