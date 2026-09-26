import { CheckCircle2 } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { printQtyForUnit } from "@/lib/embroidery";
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
  if (invoice.invoiceType === "ISSUE") return "فاتورة صرف مخزني";
  if (invoice.type === "purchase") return "فاتورة مشتريات";
  return "فاتورة مبيعات";
}

/**
 * فاتورة A4 — مطابقة للنموذج الرسمي المرفق:
 * أعمدة الكمية (طاقة/وار/فرشات) · مجاميع ثلاثية · شريط سفلي كحلي.
 * الترويسة والشعار من إعدادات المنشأة فقط.
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
  const isDeferred = invoice.paymentType === "deferred" || invoice.paymentType === "credit";
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
      {/* ترويسة من إعدادات المنشأة */}
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

      {/* شارة العنوان + الرقم والتاريخ */}
      <div className="inv-band">
        <div className="inv-band__title">{invoiceTitle(invoice)}</div>
        <div className="inv-band__meta">
          <div className="inv-meta-row">
            <span>الرقم:</span>
            <strong dir="ltr">{invoice.invoiceNumber || "................"}</strong>
          </div>
          <div className="inv-meta-row">
            <span>التاريخ:</span>
            <strong dir="ltr">{formatDate(invoice.date)}</strong>
          </div>
        </div>
      </div>

      {/* نوع الدفع: نقداً / أجل */}
      <div className="inv-pay-row">
        <span className="inv-pay-label">فاتورة</span>
        <span className={`inv-opt ${isCash || (!isDeferred && !isPartial) ? "is-on" : ""}`}>
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

      {/* الطرف */}
      <div className="inv-party">
        <div className="inv-party__line">
          <span>المطلوب من الأخ :</span>
          <strong>{partyName || "................................"}</strong>
        </div>
        <div className="inv-party__line inv-party__line--tail">
          <span>المحترمون</span>
        </div>
      </div>

      {/* جدول البنود */}
      <section className="doc-table-wrap inv-table-wrap">
        <table className="doc-table inv-table">
          <thead>
            <tr>
              <th rowSpan={2} className="col-index">
                رقم
                <br />
                البند
              </th>
              <th rowSpan={2} className="col-desc-h">
                البيان
                <span className="th-en">Description</span>
              </th>
              <th colSpan={3} className="col-qty-group">
                الكمية
              </th>
              <th rowSpan={2} className="col-price-h">
                سعر الوحدة
              </th>
              <th rowSpan={2} className="col-total-h">
                القيمة الاجمالية
                <span className="th-en">Total Amount</span>
              </th>
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
                <td className="col-number">{printQtyForUnit(item, "taqa")}</td>
                <td className="col-number">{printQtyForUnit(item, "war")}</td>
                <td className="col-number">{printQtyForUnit(item, "brush")}</td>
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

      {/* المجاميع: صندوق قيم + تسميات ملونة — مطابق للصورة */}
      <div className="inv-totals-block">
        <div className="inv-totals-values" aria-hidden={false}>
          <div className="inv-totals-value-line" dir="ltr">
            {money(total)}
          </div>
          <div className="inv-totals-value-line" dir="ltr">
            {money(previousBalance)}
          </div>
          <div className="inv-totals-value-line inv-totals-value-line--grand" dir="ltr">
            {money(grandTotal)}
          </div>
        </div>
        <div className="inv-totals-labels">
          <div className="inv-totals-label">
            <span className="inv-totals-ico" aria-hidden>
              ▣
            </span>
            اجمالي الفاتورة
          </div>
          <div className="inv-totals-label">
            <span className="inv-totals-ico" aria-hidden>
              ▣
            </span>
            الرصيد السابق
          </div>
          <div className="inv-totals-label inv-totals-label--gold">
            <span className="inv-totals-ico" aria-hidden>
              ▣
            </span>
            الاجمالي الكلي
          </div>
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
          {remaining > 0 && paid > 0 ? (
            <span>
              المتبقي: <strong dir="ltr">{money(remaining)}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* إقرار الاستلام */}
      <div className="inv-ack">
        <span className="inv-ack__icon" aria-hidden>
          ✎
        </span>
        <p>
          إستلمت البضاعة الموضحة أعلاه كاملة ومطابقة للتفاصيل مع إلتزامي بدفع القيمة خلال فترة أقصاها
          (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) من تحرير الفاتورة
        </p>
      </div>

      {/* التوقيعات */}
      <div className="doc-signs inv-signs">
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المبيعات</div>
          <div className="doc-sign__line" />
        </div>
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المستلم</div>
          <div className="doc-sign__line" />
        </div>
      </div>

      {/* الشريط السفلي — مطابق للصورة */}
      <footer className="doc-foot inv-foot">
        <span className="inv-foot__item">
          <span className="inv-foot__ico" aria-hidden>
            ☎
          </span>
          {companyPhones}
        </span>
        <span className="inv-foot__sep" aria-hidden>
          |
        </span>
        <span className="inv-foot__item">
          <span className="inv-foot__ico" aria-hidden>
            📍
          </span>
          {companyAddress}
        </span>
      </footer>
    </PrintPreview>
  );
}
