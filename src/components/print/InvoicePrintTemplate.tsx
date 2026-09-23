import { CheckCircle2 } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { amountInArabicWords } from "@/lib/numbers-ar";
import { methodLabel, paymentTypeLabel, statusLabel } from "@/lib/labels";
import PrintPreview from "./PrintPreview";

interface InvoicePrintTemplateProps {
  invoice: Invoice;
  partyName: string;
  onClose: () => void;
}

function numeric(value: number): string {
  return formatMoney(Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

function invoiceKindLabel(invoice: Invoice): string {
  if (invoice.invoiceType === "SERVICE") return "فاتورة خدمة تطريز";
  if (invoice.invoiceType === "ISSUE") return "فاتورة صرف مخزني";
  if (invoice.type === "purchase") return "فاتورة مشتريات";
  return "فاتورة مبيعات";
}

function invoiceStatusStamp(invoice: Invoice): { label: string; tone: string } | null {
  if (invoice.isCancelled) return { label: "ملغاة", tone: "doc-stamp--cancelled" };
  if (!invoice.isApproved) return { label: "مسودة — غير معتمدة", tone: "doc-stamp--draft" };
  return { label: "معتمدة", tone: "doc-stamp--approved" };
}

/**
 * فاتورة A4 احترافية.
 *
 * المعادلة الحسابية المعروضة مطابقة لما يُرحَّل فعليًا على الذمم:
 * إجمالي الفاتورة − المدفوع = المتبقي، ثم الرصيد السابق ± المتبقي = الرصيد بعد الفاتورة.
 * لا يُعرض أي رقم لا يطابق بنود الفاتورة (المجاميع تُحسب من البنود لا تُقرأ جاهزة).
 */
export default function InvoicePrintTemplate({
  invoice,
  partyName,
  onClose,
}: InvoicePrintTemplateProps) {
  const {
    customers,
    suppliers,
    approveInvoice,
    settings: companySettings,
    organization,
  } = useStore();

  const party =
    invoice.type === "sale"
      ? customers.find((customer) => customer.id === invoice.partyId)
      : suppliers.find((supplier) => supplier.id === invoice.partyId);

  const subTotal = invoice.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const discount = Math.max(0, Number(invoice.discount) || 0);
  const total = Math.max(0, subTotal - discount);
  const paid = Math.max(0, Number(invoice.paidAmount) || 0);
  const remaining = Math.max(0, total - paid);

  // الرصيد السابق: إذا كانت الفاتورة معتمدة فالرصيد الحالي يتضمن أثرها، فنطرحه.
  const currentBalance = Number(party?.balance) || 0;
  const previousBalance = invoice.isApproved
    ? invoice.type === "sale"
      ? currentBalance - remaining
      : currentBalance + remaining
    : currentBalance;
  const balanceAfter =
    invoice.type === "sale" ? previousBalance + remaining : previousBalance - remaining;

  const stamp = invoiceStatusStamp(invoice);
  const companyName = organization.name || companySettings.name;
  const companyAddress = organization.address || companySettings.location;
  const companyPhones =
    organization.phone ||
    [companySettings.phone1, companySettings.phone2].filter(Boolean).join(" · ");
  // صفوف فارغة لتظهر الفاتورة القصيرة كصفحة كاملة مرتبة (لا تتجاوز 6 صفوف).
  const emptyRows = Math.max(0, Math.min(6, 6 - invoice.items.length));

  return (
    <PrintPreview
      title="معاينة الفاتورة قبل الطباعة"
      subtitle={invoiceKindLabel(invoice)}
      paper="a4"
      fileName={`فاتورة_${invoice.invoiceNumber}_${partyName || "نقدي"}`}
      shareText={`فاتورة ${invoice.invoiceNumber} — ${companyName}`}
      onClose={onClose}
      extraAction={
        invoice.isApproved ? null : (
          <button
            type="button"
            className="print-btn"
            onClick={async () => {
              if (
                !confirm("هل أنت متأكد من اعتماد هذه الفاتورة؟ سيتم ترحيلها إلى الحسابات والمخزون.")
              )
                return;
              const ok = await approveInvoice(invoice.id);
              if (ok) onClose();
            }}
          >
            <CheckCircle2 className="size-4" />
            <span>اعتماد الفاتورة</span>
          </button>
        )
      }
    >
      <header className="doc-head">
        <div className="doc-head__copy">
          <h1 className="doc-head__name">{companyName}</h1>
          <div className="doc-head__meta">{companyAddress}</div>
          <div className="doc-head__phones">{companyPhones}</div>
          {(organization.commercialNumber || organization.taxNumber) && (
            <div className="doc-head__extra">
              {organization.commercialNumber ? `س.ت: ${organization.commercialNumber}` : ""}
              {organization.commercialNumber && organization.taxNumber ? " · " : ""}
              {organization.taxNumber ? `الرقم الضريبي: ${organization.taxNumber}` : ""}
            </div>
          )}
        </div>
        <div className="doc-head__logo">
          <img src={organization.logo || "/favicon.svg"} alt="شعار المنشأة" />
        </div>
      </header>

      {stamp ? <span className={`doc-stamp ${stamp.tone}`}>{stamp.label}</span> : null}

      <section className="doc-band" aria-label="بيانات الفاتورة">
        <div className="doc-band__cell doc-band__cell--number">
          <span>رقم الفاتورة</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <div className="doc-band__title">
          <h1>{invoiceKindLabel(invoice)}</h1>
          <span>Invoice</span>
        </div>
        <div className="doc-band__cell">
          <span>التاريخ</span>
          <strong>{formatDate(invoice.date)}</strong>
        </div>
      </section>

      <section className="doc-party">
        <span className="doc-party__label">{invoice.type === "sale" ? "السيد /" : "المورد /"}</span>
        <strong className="doc-party__name">{partyName || "عميل نقدي"}</strong>
        <span className="doc-party__tail">
          {party?.phone ? `هاتف: ${party.phone}` : ""}
          {party?.phone && paymentTypeLabel[invoice.paymentType] ? " · " : ""}
          {paymentTypeLabel[invoice.paymentType]}
          {invoice.paymentMethod ? ` · ${methodLabel[invoice.paymentMethod]}` : ""}
        </span>
      </section>

      <section className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th className="col-index">م</th>
              <th className="col-desc">البيان</th>
              <th className="col-number">الكمية</th>
              <th className="col-number">الوحدة</th>
              <th className="col-number">سعر الوحدة</th>
              <th className="col-number">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id || index}>
                <td className="col-index">{index + 1}</td>
                <td className="col-desc">
                  {item.name}
                  {item.description ? (
                    <span className="doc-table__item-desc">{item.description}</span>
                  ) : null}
                </td>
                <td className="col-number">{item.quantity}</td>
                <td className="col-number">{item.unit || "—"}</td>
                <td className="col-number">{numeric(item.unitPrice)}</td>
                <td className="col-number">{numeric(item.total)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, index) => (
              <tr key={`empty-${index}`} className="doc-table__empty" aria-hidden="true">
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>الإجمالي قبل الخصم</td>
              <td colSpan={3}>{numeric(subTotal)} ر.ي</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="doc-summary">
        <div className="doc-note-box">
          <span className="doc-label">البيان / ملاحظات</span>
          <div className="doc-note-text">{invoice.notes?.trim() || "—"}</div>
          <span className="doc-label" style={{ marginTop: "5mm" }}>
            حالة السداد
          </span>
          <div className="doc-note-text" style={{ minHeight: "auto" }}>
            {statusLabel[invoice.status]}
            {remaining > 0 ? ` — المتبقي ${numeric(remaining)} ر.ي` : " — لا يوجد متبقٍ"}
          </div>
        </div>

        <div className="doc-totals">
          <div className="doc-total-line">
            <span>الإجمالي قبل الخصم</span>
            <strong>{numeric(subTotal)}</strong>
          </div>
          <div className="doc-total-line">
            <span>الخصم</span>
            <strong>{numeric(discount)}</strong>
          </div>
          <div className="doc-total-line doc-total-line--grand">
            <span>إجمالي الفاتورة</span>
            <strong>{numeric(total)}</strong>
          </div>
          <div className="doc-total-line">
            <span>المدفوع</span>
            <strong>{numeric(paid)}</strong>
          </div>
          <div className="doc-total-line doc-total-line--accent">
            <span>المتبقي</span>
            <strong>{numeric(remaining)}</strong>
          </div>
          <div className="doc-total-line">
            <span>الرصيد السابق</span>
            <strong>{numeric(previousBalance)}</strong>
          </div>
          <div className="doc-total-line doc-total-line--accent">
            <span>الرصيد بعد الفاتورة</span>
            <strong>{numeric(balanceAfter)}</strong>
          </div>
          <div className="doc-words">
            <span className="doc-label">المبلغ كتابةً</span>
            <p>{amountInArabicWords(total)}</p>
          </div>
        </div>
      </section>

      <div className="doc-signs">
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المستلم</div>
          <div className="doc-sign__name">{partyName || "عميل نقدي"}</div>
          <div className="doc-sign__line" />
        </div>
        <div className="doc-sign">
          <div className="doc-sign__title">توقيع المسؤول</div>
          <div className="doc-sign__name">{companySettings.name}</div>
          <div className="doc-sign__line" />
        </div>
      </div>

      <footer className="doc-foot">
        <span>
          {organization.footerText || "شكرًا لتعاملكم معنا — نرجو مراجعة الفاتورة عند الاستلام."}
        </span>
        <span className="doc-foot__note" dir="ltr">
          {invoice.invoiceNumber}
        </span>
      </footer>
    </PrintPreview>
  );
}
