import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Search, Wallet, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { cashBalance } from "@/lib/accounting";
import { methodLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { formatCurrency, formatDate, nextNumber, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/cashbox")({ component: CashBoxPage });

function CashBoxPage() {
  const transactions = useStore((s) => s.transactions);
  const vouchers = useStore((s) => s.vouchers);
  const addVoucher = useStore((s) => s.addVoucher);
  const deleteVoucher = useStore((s) => s.deleteVoucher);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const deleteInvoice = useStore((s) => s.deleteInvoice);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [directType, setDirectType] = useState<"receipt" | "payment">("receipt");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (!(t.cashIn || t.cashOut)) return false;
        const matchQ = t.description.includes(q) || t.documentNumber.includes(q);
        const matchFrom = !from || t.date >= from;
        const matchTo = !to || t.date <= to;
        return matchQ && matchFrom && matchTo;
      }),
    [transactions, q, from, to],
  );

  const cashIn = filtered.reduce((s, t) => s + t.cashIn, 0);
  const cashOut = filtered.reduce((s, t) => s + t.cashOut, 0);
  const total = cashBalance(transactions);

  const saveDirect = () => {
    const n = parseFloat(amount) || 0;
    if (n <= 0 || !desc.trim()) return toast.error("أدخل المبلغ والبيان");
    const prefix = directType === "receipt" ? "DIR" : "DOUT";
    addVoucher({
      voucherNumber: nextNumber(
        vouchers.map((v) => v.voucherNumber),
        prefix,
      ),
      type: directType,
      partyType: "other",
      amount: n,
      date: todayIso(),
      paymentMethod: method,
      description: desc.trim(),
    });
    toast.success("تم تسجيل الحركة");
    setOpen(false);
    setAmount("");
    setDesc("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">صندوق الماليات</h1>
          <p className="page-subtitle">حركات القبض والصرف والرصيد الفعلي.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Wallet className="size-5" />
          حركة مباشرة
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold text-muted">إجمالي القبض</p>
          <p className="text-lg font-black tabular-nums text-good sm:text-2xl">{formatCurrency(cashIn)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold text-muted">إجمالي الصرف</p>
          <p className="text-lg font-black tabular-nums text-bad sm:text-2xl">{formatCurrency(cashOut)}</p>
        </div>
        <div className="card bg-brand p-4 text-brand-fg">
          <p className="text-xs font-bold opacity-90">رصيد الصندوق</p>
          <p className="text-lg font-black tabular-nums sm:text-2xl">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input className="input-field pr-10" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="لا توجد حركات نقدية في الفترة" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const inn = t.cashIn > 0;
            return (
              <div key={t.id} className="card flex items-center gap-3 p-3 group">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${inn ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
                  {inn ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(t.date)} · {t.documentNumber}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-black tabular-nums ${inn ? "text-good" : "text-bad"}`}>
                    {inn ? "+" : "-"}
                    {formatCurrency(inn ? t.cashIn : t.cashOut)}
                  </p>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!confirm("هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف المستند المرتبط بها (فاتورة/سند/مصروف).")) return;
                      if (t.documentType === "voucher") deleteVoucher(t.documentId);
                      else if (t.documentType === "expense") deleteExpense(t.documentId);
                      else if (t.documentType === "invoice") deleteInvoice(t.documentId);
                      toast.success("تم الحذف بنجاح");
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-bad-soft text-bad opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title="حركة صندوق مباشرة"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-primary" onClick={saveDirect}>
              تسجيل
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="flex rounded-2xl bg-canvas p-1">
            {(["receipt", "payment"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDirectType(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${directType === t ? (t === "receipt" ? "bg-good text-brand-fg" : "bg-bad text-brand-fg") : "text-muted"}`}
              >
                {t === "receipt" ? "قبض" : "صرف"}
              </button>
            ))}
          </div>
          <label>
            <span className="label">المبلغ</span>
            <input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            <span className="label">البيان</span>
            <input className="input-field" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label>
            <span className="label">الطريقة</span>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(methodLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
