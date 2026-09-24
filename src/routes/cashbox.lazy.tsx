import { createLazyFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Banknote,
  CalendarDays,
  CreditCard,
  Landmark,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { AppSelect } from "@/components/ui/AppSelect";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import {
  Alert,
  Chip,
  FilterChip,
  Money,
  PageHeader,
  SearchField,
  SectionCard,
  StatCard,
  StatGrid,
} from "@/components/ui/kit";
import { cashBalance } from "@/lib/accounting";
import { methodLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { cn, formatMoney, nextNumber, todayIso } from "@/lib/utils";

export const Route = createLazyFileRoute("/cashbox")({ component: CashBoxPage });

type RangeKey = "all" | "today" | "week" | "month";

const PAYMENT_METHODS: PaymentMethod[] = ["cash"];

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  remittance: Landmark,
  jeeb: Wallet,
  e_wallet: CreditCard,
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "today", label: "اليوم" },
  { key: "week", label: "آخر 7 أيام" },
  { key: "month", label: "هذا الشهر" },
];

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (key === "today") return { from: iso(now), to: iso(now) };
  if (key === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: iso(start), to: iso(now) };
  }
  if (key === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  return { from: "", to: "" };
}

function CashBoxPage() {
  const transactions = useStore((s) => s.transactions);
  const vouchers = useStore((s) => s.vouchers);
  const addVoucher = useStore((s) => s.addVoucher);
  const deleteVoucher = useStore((s) => s.deleteVoucher);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const deleteInvoice = useStore((s) => s.deleteInvoice);

  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [directType, setDirectType] = useState<"receipt" | "payment">("receipt");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const applyRange = (key: RangeKey) => {
    setRange(key);
    const r = rangeFor(key);
    setFrom(r.from);
    setTo(r.to);
  };

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (!(t.cashIn || t.cashOut)) return false;
        const matchQ = !q || t.description.includes(q) || t.documentNumber.includes(q);
        const matchFrom = !from || t.date >= from;
        const matchTo = !to || t.date <= to;
        return matchQ && matchFrom && matchTo;
      }),
    [transactions, q, from, to],
  );

  const cashIn = filtered.reduce((s, t) => s + t.cashIn, 0);
  const cashOut = filtered.reduce((s, t) => s + t.cashOut, 0);
  const total = cashBalance(transactions);

  const byMethod = useMemo(() => {
    const map = new Map<PaymentMethod, { inn: number; out: number }>();
    PAYMENT_METHODS.forEach((m) => map.set(m, { inn: 0, out: 0 }));
    transactions.forEach((t) => {
      if (!t.paymentMethod) return;
      const entry = map.get(t.paymentMethod) ?? { inn: 0, out: 0 };
      entry.inn += t.cashIn || 0;
      entry.out += t.cashOut || 0;
      map.set(t.paymentMethod, entry);
    });
    return map;
  }, [transactions]);

  const saveDirect = () => {
    const n = Number.parseFloat(amount) || 0;
    if (n <= 0 || !desc.trim()) {
      toast.error("أدخل المبلغ والبيان");
      return;
    }
    if (directType === "payment" && n > total) {
      toast.error(`رصيد الصندوق غير كافٍ (${formatMoney(total)})`);
      return;
    }
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
      <PageHeader
        title="صندوق الماليات"
        subtitle="حركات القبض والصرف والرصيد الفعلي."
        icon={Wallet}
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            <Plus className="size-5" />
            حركة مباشرة
          </button>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="إجمالي القبض" value={formatMoney(cashIn)} icon={ArrowDownLeft} tone="good" hint="في النطاق المحدد" />
        <StatCard label="إجمالي الصرف" value={formatMoney(cashOut)} icon={ArrowUpLeft} tone="bad" hint="في النطاق المحدد" />
        <StatCard label="عدد الحركات" value={filtered.length} icon={CalendarDays} tone="navy" hint="قبض وصرف" />
        <StatCard label="رصيد الصندوق" value={formatMoney(total)} icon={Wallet} tone="brand" hint="الرصيد الكلي الآن" />
      </StatGrid>

      {/* ————— توزيع الطرق ————— */}
      <SectionCard title="الرصيد حسب طريقة الدفع" icon={Landmark} tone="navy" bodyClassName="grid gap-3 sm:grid-cols-4 p-4 sm:p-5">
        {PAYMENT_METHODS.map((m) => {
          const entry = byMethod.get(m) ?? { inn: 0, out: 0 };
          const balance = entry.inn - entry.out;
          const Icon = METHOD_ICON[m];
          return (
            <div key={m} className="card-sunken p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-muted">{methodLabel[m]}</span>
                <Icon className="size-4 text-muted" />
              </div>
              <Money
                value={formatMoney(balance)}
                tone={balance >= 0 ? "good" : "bad"}
                className="mt-2 block text-lg"
              />
              <p className="mt-1 text-[11px] font-bold text-muted">
                قبض {formatMoney(entry.inn)} · صرف {formatMoney(entry.out)}
              </p>
            </div>
          );
        })}
      </SectionCard>

      {/* ————— التصفية ————— */}
      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <FilterChip key={r.key} active={range === r.key} onClick={() => applyRange(r.key)}>
              {r.label}
            </FilterChip>
          ))}
          {(from || to || q) && (
            <button
              type="button"
              className="mr-auto text-[11px] font-black text-brand hover:underline"
              onClick={() => {
                setQ("");
                applyRange("all");
              }}
            >
              مسح التصفية
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchField value={q} onChange={setQ} placeholder="ابحث بالبيان أو رقم المستند…" />
          <AppDatePicker value={from} onChange={setFrom} label="من تاريخ" />
          <AppDatePicker value={to} onChange={setTo} label="إلى تاريخ" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Wallet}
            title="لا توجد حركات نقدية في الفترة"
            hint="غيّر النطاق الزمني أو سجّل حركة مباشرة."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const inn = t.cashIn > 0;
            return (
              <div key={t.id} className="list-row group">
                <span className={cn("tile-icon", inn ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                  {inn ? <ArrowDownLeft className="size-5" /> : <ArrowUpLeft className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{t.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="num text-[11px] font-bold text-muted">{t.documentNumber}</span>
                    <span className="text-[11px] text-muted">·</span>
                    <span className="text-[11px] font-bold text-muted">{t.date}</span>
                    {t.paymentMethod ? (
                      <Chip tone={inn ? "good" : "bad"}>{methodLabel[t.paymentMethod]}</Chip>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money
                    value={`${inn ? "+" : "−"}${formatMoney(inn ? t.cashIn : t.cashOut)}`}
                    tone={inn ? "good" : "bad"}
                    className="text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !confirm(
                          "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف المستند المرتبط بها (فاتورة/سند/مصروف).",
                        )
                      )
                        return;
                      if (t.documentType === "voucher") deleteVoucher(t.documentId);
                      else if (t.documentType === "expense") deleteExpense(t.documentId);
                      else if (t.documentType === "invoice") deleteInvoice(t.documentId);
                      toast.success("تم الحذف بنجاح");
                    }}
                    className="flex size-8 items-center justify-center rounded-xl bg-bad-soft text-bad opacity-100 transition-opacity hover:bg-bad/15 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="حذف الحركة"
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
              تسجيل الحركة
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex gap-2">
            {(["receipt", "payment"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDirectType(t)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition",
                  directType === t
                    ? t === "receipt"
                      ? "border-good bg-good text-brand-fg shadow-soft"
                      : "border-bad bg-bad text-brand-fg shadow-soft"
                    : "border-line bg-paper text-muted hover:border-brand/30",
                )}
              >
                {t === "receipt" ? <ArrowDownLeft className="size-4" /> : <ArrowUpLeft className="size-4" />}
                {t === "receipt" ? "قبض" : "صرف"}
              </button>
            ))}
          </div>

          <label>
            <span className="label">المبلغ</span>
            <input
              className="input-field num text-lg"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </label>

          <label>
            <span className="label">البيان</span>
            <input
              className="input-field"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="مثال: إيجار ورشة — أكتوبر"
            />
          </label>

          <div>
            <span className="label">طريقة الدفع</span>
            <AppSelect
              value={method}
              onChange={(v) => setMethod(v as PaymentMethod)}
              options={[{ value: "cash", label: methodLabel.cash }]}
              searchable={false}
            />
          </div>

          {directType === "payment" && Number.parseFloat(amount) > total ? (
            <Alert tone="bad" icon={ArrowUpLeft} title="المبلغ أكبر من رصيد الصندوق">
              الرصيد المتاح الآن {formatMoney(total)}.
            </Alert>
          ) : (
            <p className="text-[11px] font-bold text-muted">
              سيُسجَّل السند تلقائيًا برقم تسلسلي ويظهر في كشوف الحساب.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
