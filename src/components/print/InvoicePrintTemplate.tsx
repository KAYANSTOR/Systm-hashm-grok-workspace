import React, { useRef } from "react";
import { CheckCircle, Download, Printer, Share2, X } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useStore } from "@/lib/store";
import "./InvoicePrint.css";

interface InvoicePrintTemplateProps {
  invoice: Invoice;
  partyName: string;
  onClose: () => void;
}

function numericValue(value: number): string {
  return formatCurrency(value).replace(/\s*ر\.ي\s*$/, "");
}

function invoiceKindLabel(invoice: Invoice): string {
  if (invoice.invoiceType === "SERVICE") return "فاتورة خدمة";
  if (invoice.invoiceType === "ISSUE") return "فاتورة صرف";
  return invoice.type === "purchase" ? "فاتورة مشتريات" : "فاتورة نقدية";
}

export default function InvoicePrintTemplate({ invoice, partyName, onClose }: InvoicePrintTemplateProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { customers, suppliers, approveInvoice, settings: companySettings } = useStore();

  const party = invoice.type === "sale"
    ? customers.find((customer) => customer.id === invoice.partyId)
    : suppliers.find((supplier) => supplier.id === invoice.partyId);

  const currentBalance = party?.balance || 0;
  const calculatedTotal = Math.max(0, invoice.subTotal - invoice.discount);
  // Older locally cached drafts may contain a stale total after a sync. The
  // printable document should never show a total that contradicts its lines.
  const displayTotal = invoice.total > 0 || calculatedTotal === 0 ? invoice.total : calculatedTotal;
  const displayPaid = invoice.paidAmount;
  const displayRemaining = Math.max(0, displayTotal - displayPaid);
  let previousBalance = currentBalance;
  if (invoice.isApproved) {
    previousBalance = invoice.type === "sale"
      ? currentBalance - displayRemaining
      : currentBalance + displayRemaining;
  }
  const grandTotal = previousBalance + (invoice.type === "sale" ? displayRemaining : -displayRemaining);
  const emptyRowsCount = Math.max(0, 8 - invoice.items.length);

  const fetchPdfBlob = async () => {
    if (!printRef.current) return null;
    try {
      const element = printRef.current;
      setIsGenerating(true);
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toJpeg(element, {
        quality: 0.96,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: `${element.scrollWidth}px`,
          height: `${element.scrollHeight}px`,
        },
        filter: (node: HTMLElement) => !node.classList?.contains("no-print"),
      });
      const { default: jsPDF } = await import("jspdf");
      const pdfWidth = 210;
      const probe = new jsPDF();
      const image = probe.getImageProperties(dataUrl);
      const pdfHeight = (image.height * pdfWidth) / image.width;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, Math.max(297, pdfHeight + 4)],
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      return pdf.output("blob");
    } catch (error) {
      console.error("Invoice PDF generation failed", error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    const blob = await fetchPdfBlob();
    if (!blob) {
      alert("تعذر إنشاء ملف PDF. حاول مرة أخرى.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `فاتورة_${invoice.invoiceNumber}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = async () => {
    const blob = await fetchPdfBlob();
    if (!blob) {
      alert("تعذر تجهيز الفاتورة للطباعة. حاول مرة أخرى.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      URL.revokeObjectURL(url);
      alert("يرجى السماح بالنوافذ المنبثقة للطباعة، أو استخدم زر تنزيل PDF.");
      return;
    }
    printWindow.addEventListener("load", () => printWindow.print(), { once: true });
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleShare = async () => {
    const blob = await fetchPdfBlob();
    if (!blob) {
      alert("تعذر تجهيز الفاتورة للمشاركة. حاول مرة أخرى.");
      return;
    }
    const file = new File([blob], `فاتورة_${invoice.invoiceNumber}.pdf`, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `فاتورة ${invoice.invoiceNumber}`, files: [file] });
        return;
      }
      alert("المتصفح لا يدعم مشاركة الملفات مباشرة. استخدم تنزيل PDF ثم شارك الملف.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") alert("تعذر مشاركة الفاتورة.");
    }
  };

  return (
    <div className="invoice-preview-shell fixed inset-0 z-50 flex flex-col items-center bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div className="flex h-full w-full max-w-[210mm] flex-col bg-slate-100 shadow-2xl">
        <div className="no-print flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="font-bold text-slate-800">معاينة الفاتورة</h2>
            <p className="text-xs text-slate-500">A4 · جاهزة للطباعة والتنزيل والمشاركة</p>
          </div>
          <div className="flex items-center gap-2">
            {!invoice.isApproved && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm("هل أنت متأكد من اعتماد هذه الفاتورة؟ سيتم ترحيلها إلى الحسابات والمخزون.")) {
                    await approveInvoice(invoice.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
              >
                <CheckCircle className="size-4" /> <span className="hidden sm:inline">اعتماد</span>
              </button>
            )}
            <button type="button" onClick={handleShare} disabled={isGenerating} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">
              <Share2 className="size-4" /> <span className="hidden sm:inline">مشاركة</span>
            </button>
            <button type="button" onClick={handleDownloadPDF} disabled={isGenerating} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50">
              <Download className="size-4" /> <span className="hidden sm:inline">{isGenerating ? "جاري التجهيز" : "تنزيل PDF"}</span>
            </button>
            <button type="button" onClick={handlePrint} disabled={isGenerating} className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50">
              <Printer className="size-4" /> <span className="hidden sm:inline">طباعة</span>
            </button>
            <button type="button" onClick={onClose} aria-label="إغلاق المعاينة" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div ref={printRef} className="invoice-print-page mx-auto">
            <header className="invoice-brand-header">
              <div className="invoice-brand-copy">
              <h1 className="invoice-company-name">{companySettings.name}</h1>
                <div className="invoice-company-meta">{companySettings.location}</div>
                <div className="invoice-company-phone">{[companySettings.phone1, companySettings.phone2].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="invoice-logo-box">
                <img src="/favicon.svg" alt="شعار المنشأة" />
              </div>
            </header>

            <section className="invoice-document-bar" aria-label="بيانات الفاتورة">
              <div className="invoice-meta-cell invoice-meta-number">
                <span>الرقم</span>
                <strong>{invoice.invoiceNumber}</strong>
              </div>
              <div className="invoice-title-cell">
                <h1>{invoiceKindLabel(invoice)}</h1>
                <span>INVOICE DOCUMENT</span>
              </div>
              <div className="invoice-meta-cell">
                <span>التاريخ</span>
                <strong>{formatDate(invoice.date)}</strong>
              </div>
            </section>

            <section className="invoice-party-card">
              <span className="invoice-party-label">المطلوب من الأخ</span>
              <strong className="invoice-party-name">{partyName || "نقدي"}</strong>
              <span className="invoice-party-kind">المحترمون</span>
            </section>

            <section className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th className="col-no">#</th>
                    <th className="col-description">البيان<br /><span>Description</span></th>
                    <th className="col-quantity">الكمية</th>
                    <th className="col-unit-price">السعر<br /><span>سعر الوحدة</span></th>
                    <th className="col-total">القيمة الإجمالية<br /><span>Total Amount</span></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="invoice-number">{index + 1}</td>
                      <td className="invoice-item-name">
                        {item.name}
                        {item.description && <span className="invoice-item-description">{item.description}</span>}
                      </td>
                      <td className="invoice-number">{item.quantity} {item.unit || ""}</td>
                      <td className="invoice-money">{numericValue(item.unitPrice)}</td>
                      <td className="invoice-money">{numericValue(item.total)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: emptyRowsCount }).map((_, index) => (
                    <tr key={`empty-${index}`} className="invoice-empty-row" aria-hidden="true">
                      <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="invoice-summary-row">
              <div className="invoice-notes-box">
                <span className="invoice-section-label">البيان</span>
                <div className="invoice-notes">{invoice.notes || ""}</div>
                <div className="invoice-signature-lines">
                  <span>توقيع المستلم</span>
                  <span>توقيع المسؤول</span>
                </div>
              </div>
              <div className="invoice-totals">
                <div className="invoice-total-line is-grand"><span>إجمالي الفاتورة</span><strong>{formatCurrency(displayTotal)}</strong></div>
                <div className="invoice-total-line"><span>الرصيد السابق</span><strong>{formatCurrency(previousBalance)}</strong></div>
                <div className="invoice-total-line"><span>الإجمالي الكلي</span><strong>{formatCurrency(grandTotal)}</strong></div>
              </div>
            </section>

            <footer className="invoice-footer">
              <span className="invoice-footer-status">توقيع المستلم ................................</span>
              <span>هل حُررت الفاتورة (   )</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
