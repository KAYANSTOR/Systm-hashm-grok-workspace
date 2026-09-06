import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Plus, Printer, Receipt, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import VoucherPrintTemplate from "@/components/print/VoucherPrintTemplate";
import { methodLabel, voucherTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { PartyKind, PaymentMethod, Voucher, VoucherType } from "@/lib/types";
import { formatCurrency, formatDate, nextNumber, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/vouchers")({ component: VouchersPage });

function VouchersPage() {
  const vouchers = useStore((s) => s.vouchers);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const addVoucher = useStore((s) => s.addVoucher);
  const deleteVoucher = useStore((s) => s.deleteVoucher);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | VoucherType>("all");
  const [open, setOpen] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);

  const [voucherNumber, setVoucherNumber] = useState("");
  const [type, setType] = useState<VoucherType>("receipt");
  const [partyType, setPartyType] = useState<PartyKind>("customer");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [description, setDescription] = useState("");

  const partyName = useCallback((v: Voucher) => {
    if (v.partyType === "customer") return customers.find((c) => c.id === v.partyId)?.name || "—";
    if (v.partyType === "supplier") return suppliers.find((s) => s.id === v.partyId)?.name || "—";
    return "أخرى";
  }, [customers, suppliers]);

  const filtered = useMemo(
    () =>
      vouchers
        .filter((v) => filter === "all" || v.type === filter)
        .filter(
          (v) =>
            v.voucherNumber.includes(q) ||
            v.description.includes(q) ||
            partyName(v).includes(q),
        ),
    [vouchers, filter, q, partyName],
  );

  const openNew = (t: VoucherType) => {
    const prefix = t === "receipt" ? "REC" : t === "payment" ? "PAY" : "JOU";
    setVoucherNumber(nextNumber(vouchers.filter((v) => v.type === t).map((v) => v.voucherNumber), prefix));
    setType(t);
    setPartyType(t === "receipt" ? "customer" : t === "payment" ? "supplier" : "other");
    setPartyId("");
    setAmount("");
    setDate(todayIso());
    setPaymentMethod("cash");
    setDescription("");
    setOpen(true);
  };

  const save = () => {
    const n = parseFloat(amount) || 0;
    if (n <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    if (partyType !== "other" && !partyId) return toast.error("اختر الطرف");
    addVoucher({
      voucherNumber,
      type,
      partyType,
      partyId: partyId || undefined,
      amount: n,
      date,
      paymentMethod,
      description,
    });
    toast.success("تم حفظ السند");
    setOpen(false);
  };

  const parties = partyType === "customer" ? customers : partyType === "supplier" ? suppliers : [];
  const printing = vouchers.find((v) => v.id === printId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">السندات</h1>
          <p className="page-subtitle">قبض من العملاء وصرف للموردين.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => openNew("receipt")}>
            <ArrowDownRight className="size-5" />
            سند قبض
          </button>
          <button type="button" className="btn-danger" onClick={() => openNew("payment")}>
            <ArrowUpRight className="size-5" />
            سند صرف
          </button>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input className="input-field pr-10" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", "receipt", "payment"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold ${filter === f ? "bg-brand text-brand-fg" : "bg-canvas text-muted"}`}
            >
              {f === "all" ? "الكل" : voucherTypeLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Receipt} title="لا توجد سندات" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const inn = v.type === "receipt";
            return (
              <article key={v.id} className="card flex items-center gap-3 p-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${inn ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
                  {inn ? <ArrowDownRight className="size-6" /> : <ArrowUpRight className="size-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted">{v.voucherNumber}</p>
                  <h3 className="truncate font-black">{partyName(v)}</h3>
                  <p className="truncate text-xs text-muted">
                    {formatDate(v.date)} · {methodLabel[v.paymentMethod]} · {v.description}
                  </p>
                </div>
                <div className="text-left">
                  <p className={`font-black tabular-nums ${inn ? "text-good" : "text-bad"}`}>
                    {formatCurrency(v.amount)}
                  </p>
                  <div className="mt-1 flex justify-end gap-1">
                    <button type="button" className="btn-icon size-8" onClick={() => setPrintId(v.id)}>
                      <Printer className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon size-8 text-bad"
                      onClick={() => {
                        if (confirm("حذف السند وعكس أثره؟")) {
                          deleteVoucher(v.id);
                          toast.success("تم الحذف");
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title={voucherTypeLabel[type]}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              <Plus className="size-4" />
              حفظ
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <label>
            <span className="label">رقم السند</span>
            <input className="input-field" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} />
          </label>
          <label>
            <span className="label">نوع الطرف</span>
            <select
              className="input-field"
              value={partyType}
              onChange={(e) => {
                setPartyType(e.target.value as PartyKind);
                setPartyId("");
              }}
            >
              <option value="customer">عميل</option>
              <option value="supplier">مورد</option>
              <option value="other">أخرى</option>
            </select>
          </label>
          {partyType !== "other" ? (
            <label>
              <span className="label">الطرف</span>
              <select className="input-field" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">اختر…</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span className="label">المبلغ</span>
            <input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            <span className="label">التاريخ</span>
            <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span className="label">طريقة الدفع</span>
            <select
              className="input-field"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {Object.entries(methodLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">البيان</span>
            <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      </Modal>

      {printing ? (
        <VoucherPrintTemplate
          voucher={printing}
          partyName={partyName(printing)}
          onClose={() => setPrintId(null)}
        />
      ) : null}
    </div>
  );
}
