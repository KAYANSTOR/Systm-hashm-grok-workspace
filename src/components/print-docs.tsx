import { Printer, X } from "lucide-react";
import { formatCurrency, formatDate, formatMoney } from "@/lib/utils";
import { methodLabel, paymentTypeLabel, statusLabel, voucherTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Invoice, Voucher } from "@/lib/types";

export function InvoicePrint({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const { customers, suppliers, settings } = useStore();
  const party =
    invoice.type === "sale"
      ? customers.find((c) => c.id === invoice.partyId)
      : suppliers.find((s) => s.id === invoice.partyId);

  return (
    <div className="fixed inset-0 z-[90] overflow-auto bg-canvas/95 p-3 no-print-root">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 no-print">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          <X className="size-4" />
          إغلاق
        </button>
      </div>
      <article className="print-section mx-auto max-w-3xl rounded-3xl border border-line bg-paper p-8 text-ink shadow-sm">
        <header className="flex items-start justify-between gap-4 border-b-2 border-brand pb-5">
          <div>
            <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-2xl font-black text-brand">
              هـ
            </div>
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black text-brand">{settings.name}</h1>
            <p className="mt-1 text-xs text-muted">{settings.location}</p>
            <p className="text-xs text-muted" dir="ltr">
              {settings.phone1} · {settings.phone2}
            </p>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-muted">
              {invoice.type === "sale"
                ? invoice.invoiceType === "SERVICE"
                  ? "فاتورة خدمة تطريز"
                  : "فاتورة مبيعات"
                : "فاتورة مشتريات"}
            </p>
            <p className="font-mono text-lg font-black">{invoice.invoiceNumber}</p>
            <p className="text-sm text-muted">{formatDate(invoice.date)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-muted">الطرف</p>
            <p className="text-lg font-black">{party?.name ?? "—"}</p>
            <p className="text-sm text-muted">{party && "phone" in party ? party.phone : ""}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="bg-brand-soft text-brand">
              <th className="px-3 py-2 text-right font-bold">البيان</th>
              <th className="px-3 py-2 text-center font-bold">الكمية</th>
              <th className="px-3 py-2 text-center font-bold">السعر</th>
              <th className="px-3 py-2 text-left font-bold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((line) => (
              <tr key={line.id} className="border-b border-line">
                <td className="px-3 py-2">
                  <div className="font-bold">{line.name}</div>
                  {line.description ? (
                    <div className="text-xs text-muted">{line.description}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {line.quantity} {line.unit ?? ""}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">{formatMoney(line.unitPrice)}</td>
                <td className="px-3 py-2 text-left font-bold tabular-nums">
                  {formatMoney(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 mr-auto w-64 space-y-1 text-sm">
          <Row k="المجموع" v={formatCurrency(invoice.subTotal)} />
          <Row k="الخصم" v={formatCurrency(invoice.discount)} />
          <Row k="الإجمالي" v={formatCurrency(invoice.total)} strong />
          <Row k="المدفوع" v={formatCurrency(invoice.paidAmount)} />
          <Row k="المتبقي" v={formatCurrency(invoice.remainingAmount)} strong />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-canvas px-3 py-1 font-bold">
            الدفع: {paymentTypeLabel[invoice.paymentType]}
          </span>
          <span className="rounded-full bg-canvas px-3 py-1 font-bold">
            الحالة: {statusLabel[invoice.status]}
          </span>
          {invoice.notes ? (
            <span className="rounded-full bg-canvas px-3 py-1 font-bold">ملاحظات: {invoice.notes}</span>
          ) : null}
        </div>

        <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-muted">
          <div>
            <div className="mb-8 border-b border-line" />
            توقيع المستلم
          </div>
          <div>
            <div className="mb-8 border-b border-line" />
            ختم المعمل
          </div>
        </footer>
      </article>
    </div>
  );
}

export function VoucherPrint({
  voucher,
  partyName,
  onClose,
}: {
  voucher: Voucher;
  partyName: string;
  onClose: () => void;
}) {
  const { settings } = useStore();
  const isIn = voucher.type === "receipt";
  return (
    <div className="fixed inset-0 z-[90] overflow-auto bg-canvas/95 p-3">
      <div className="mx-auto mb-4 flex max-w-xl justify-end gap-2 no-print">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          <X className="size-4" />
          إغلاق
        </button>
      </div>
      <article className="print-section mx-auto max-w-xl rounded-3xl border border-line bg-paper p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-xl font-black text-brand">
            هـ
          </div>
          <h1 className="font-black text-brand">{settings.name}</h1>
          <p className="mt-2 inline-block rounded-full bg-brand px-4 py-1 text-sm font-black text-brand-fg">
            {voucherTypeLabel[voucher.type]}
          </p>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <Row k="رقم السند" v={voucher.voucherNumber} />
          <Row k="التاريخ" v={formatDate(voucher.date)} />
          <Row k="الطرف" v={partyName || "—"} />
          <Row k="المبلغ" v={formatCurrency(voucher.amount)} strong />
          <Row k="طريقة الدفع" v={methodLabel[voucher.paymentMethod]} />
          <Row k="البيان" v={voucher.description || "—"} />
        </div>
        <p className={`mt-6 rounded-2xl p-4 text-center text-2xl font-black ${isIn ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
          {formatCurrency(voucher.amount)}
        </p>
      </article>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className={strong ? "font-black tabular-nums" : "font-bold tabular-nums"}>{v}</span>
    </div>
  );
}
