import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { AppSelect } from "@/components/ui/AppSelect";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { cashBalance } from "@/lib/accounting";
import { useStore } from "@/lib/store";
import { daysAgoIso, formatCurrency, formatDate, formatMoney, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

type ReportTab = "overview" | "sales" | "cash" | "stock" | "party" | "activity";

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function ReportsPage() {
  const invoices = useStore((s) => arrayOrEmpty<any>(s.invoices));
  const customers = useStore((s) => arrayOrEmpty<any>(s.customers));
  const suppliers = useStore((s) => arrayOrEmpty<any>(s.suppliers));
  const transactions = useStore((s) => arrayOrEmpty<any>(s.transactions));
  const inventory = useStore((s) => arrayOrEmpty<any>(s.inventory));
  const warehouseStocks = useStore((s) => arrayOrEmpty<any>(s.warehouseStocks));
  const expenses = useStore((s) => arrayOrEmpty<any>(s.expenses));
  const vouchers = useStore((s) => arrayOrEmpty<any>(s.vouchers));
  const warehouses = useStore((s) => arrayOrEmpty<any>(s.warehouses));
  const auditLog = useStore((s) => arrayOrEmpty<any>(s.auditLog));
  const settings = useStore((s) => s.settings);
  const connectionState = useStore((s) => s.connectionState);
  const fetchFromDb = useStore((s) => s.fetchFromDb);

  const [tab, setTab] = useState<ReportTab>("overview");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [partyId, setPartyId] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void fetchFromDb().catch(() => undefined);
  }, [fetchFromDb]);

  const inRange = (date: string) => {
    const day = String(date || "").slice(0, 10);
    return day >= from && day <= to;
  };

  const sales = useMemo(
    () =>
      invoices.filter(
        (i) =>
          i.type === "sale" &&
          i.isApproved &&
          !i.isCancelled &&
          inRange(i.date) &&
          (partyId === "all" || i.partyId === partyId),
      ),
    [invoices, from, to, partyId],
  );

  const salesTotal = sales.reduce((s, i) => s + i.total, 0);
  const collected = sales.reduce((s, i) => s + i.paidAmount, 0);
  const expenseTotal = expenses.filter((e) => inRange(e.date)).reduce((s, e) => s + e.amount, 0);
  const receipts = vouchers
    .filter((v) => v.type === "receipt" && inRange(v.date))
    .reduce((s, v) => s + v.amount, 0);
  const cash = cashBalance({ transactions } as any);

  // Party ledger from transactions (open account — not invoice allocation)
  const partyLedger = useMemo(() => {
    if (partyId === "all") return [];
    return transactions
      .filter((t) => t.partyId === partyId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }, [transactions, partyId]);

  const partyRunning = useMemo(() => {
    let bal = 0;
    return partyLedger.map((t) => {
      const delta = (t.debit || 0) - (t.credit || 0);
      // customer: debit increases receivable; supplier inverse already in posted signs
      bal += delta;
      return { ...t, running: bal };
    });
  }, [partyLedger]);

  const partyBalance = partyRunning.length ? partyRunning[partyRunning.length - 1].running : 0;

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (let n = 6; n >= 0; n--) map.set(daysAgoIso(n), 0);
    for (const inv of sales) {
      const day = inv.date.slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) || 0) + inv.total);
    }
    return [...map.entries()].map(([date, total]) => ({ date: date.slice(5), total }));
  }, [sales]);

  const stockRows = useMemo(() => {
    return inventory
      .filter((i) => {
        if (q && !i.name.includes(q)) return false;
        return true;
      })
      .map((i) => {
        const qty =
          warehouseId === "all"
            ? i.quantity
            : warehouseStocks
                .filter((s) => s.productId === i.id && s.warehouseId === warehouseId)
                .reduce((sum, s) => sum + s.quantity, 0);
        return {
          ...i,
          quantity: qty,
          status: qty <= 0 ? "نفد" : qty <= i.minQuantity ? "منخفض" : "متوفر",
        };
      })
      .filter((i) => warehouseId === "all" || i.quantity > 0 || warehouseStocks.some((s) => s.productId === i.id && s.warehouseId === warehouseId));
  }, [inventory, q, warehouseId, warehouseStocks]);

  const stockValue = inventory.reduce((s, i) => s + i.quantity * i.costPrice, 0);

  const partyOptions = [
    { value: "all", label: "كل الأطراف" },
    ...customers.map((c) => ({ value: c.id, label: c.name, description: "عميل" })),
    ...suppliers.map((s) => ({ value: s.id, label: s.name, description: "مورد" })),
  ];

  const warehouseOptions = [
    { value: "all", label: "كل المخازن" },
    ...warehouses.filter((w) => w.isActive).map((w) => ({ value: w.id, label: w.name })),
  ];

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "overview", label: "ملخص" },
    { id: "sales", label: "المبيعات" },
    { id: "cash", label: "الصندوق" },
    { id: "stock", label: "المخزون" },
    { id: "party", label: "كشف حساب" },
    { id: "activity", label: "العمليات" },
  ];

  const detail = detailId ? auditLog.find((a) => a.auditId === detailId) : null;
  const isLoading = connectionState === "syncing" && !invoices.length && !customers.length && !inventory.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="text-sm text-muted">من مصادر الحقيقة: القيود · الحركات · المستندات</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AppDatePicker label="من تاريخ" value={from} onChange={setFrom} />
          <AppDatePicker label="إلى تاريخ" value={to} onChange={setTo} />
          <AppSelect label="الطرف" value={partyId} onChange={setPartyId} options={partyOptions} searchable />
          <AppSelect
            label="المخزن"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouseOptions}
            searchable={false}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                tab === t.id ? "bg-brand text-brand-fg" : "bg-canvas text-muted hover:bg-brand-soft"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="card p-8 text-center text-sm font-bold text-muted" role="status">
          جاري تحميل بيانات التقارير…
        </div>
      ) : null}

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi title="مبيعات الفترة" value={formatCurrency(salesTotal)} />
            <Kpi title="المقبوض (فواتير)" value={formatCurrency(collected)} />
            <Kpi title="سندات قبض" value={formatCurrency(receipts)} />
            <Kpi title="مصروفات" value={formatCurrency(expenseTotal)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi title="رصيد الصندوق (من القيود)" value={formatCurrency(cash)} />
            <Kpi title="قيمة المخزون (تكلفة)" value={formatCurrency(stockValue)} />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-black">مبيعات آخر 7 أيام</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} />
                  <Bar dataKey="total" fill="var(--color-brand)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === "sales" && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-bold text-muted">
            {sales.length} فاتورة · الإجمالي {formatCurrency(salesTotal)}
          </div>
          {sales.length === 0 ? (
            <EmptyState icon={FileText} title="لا مبيعات في الفترة" />
          ) : (
            <ul className="divide-y divide-line">
              {sales.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-black">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted">
                      {formatDate(inv.date)} ·{" "}
                      {customers.find((c) => c.id === inv.partyId)?.name || inv.partyId}
                    </p>
                  </div>
                  <p className="font-black tabular-nums">{formatCurrency(inv.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "cash" && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-bold">
            حركة الصندوق من القيود · الرصيد {formatCurrency(cash)}
          </div>
          <ul className="divide-y divide-line">
            {transactions
              .filter((t) => (t.cashIn || t.cashOut) && inRange(t.date))
              .slice(0, 100)
              .map((t) => (
                <li key={t.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold">{t.description}</p>
                    <p className="text-xs text-muted">{formatDate(t.date)}</p>
                  </div>
                  <p className={`font-black tabular-nums ${t.cashIn ? "text-good" : "text-bad"}`}>
                    {t.cashIn ? `+${formatCurrency(t.cashIn)}` : `-${formatCurrency(t.cashOut)}`}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              className="input-field pr-10"
              placeholder="بحث صنف…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted">
            الأرصدة حسب المخزن من warehouse_stock. اختيار «كل المخازن» يجمع الكميات.
          </p>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {stockRows.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-black">{i.name}</p>
                    <p className="text-xs text-muted">{i.category}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-black tabular-nums">{i.quantity}</p>
                    <span
                      className={`text-xs font-bold ${
                        i.status === "نفد" ? "text-bad" : i.status === "منخفض" ? "text-warn" : "text-good"
                      }`}
                    >
                      {i.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "party" && (
        <div className="space-y-3">
          {partyId === "all" ? (
            <div className="card p-6">
              <EmptyState icon={FileText} title="اختر عميلاً أو مورداً لعرض كشف الحساب العام" />
            </div>
          ) : (
            <>
              <div className="card p-4">
                <p className="text-sm text-muted">حساب مفتوح — الدفعات غير مربوطة بفاتورة</p>
                <p className="mt-1 text-2xl font-black tabular-nums">{formatCurrency(partyBalance)}</p>
              </div>
              <div className="card overflow-hidden">
                <div className="grid grid-cols-5 gap-1 border-b border-line bg-canvas px-3 py-2 text-[11px] font-bold text-muted">
                  <span>التاريخ</span>
                  <span className="col-span-2">البيان</span>
                  <span>مدين</span>
                  <span>دائن</span>
                </div>
                {partyRunning.length === 0 ? (
                  <p className="p-4 text-sm text-muted">لا حركات على هذا الحساب</p>
                ) : (
                  partyRunning.map((t) => (
                    <div key={t.id} className="grid grid-cols-5 gap-1 border-b border-line px-3 py-2 text-xs">
                      <span className="tabular-nums text-muted">{formatDate(t.date)}</span>
                      <span className="col-span-2 font-bold">{t.description}</span>
                      <span className="tabular-nums">{t.debit ? formatCurrency(t.debit) : "—"}</span>
                      <span className="tabular-nums">{t.credit ? formatCurrency(t.credit) : "—"}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-bold text-muted">
            سجل العمليات (محلي + خادم، مدمج بـ operation_id) · {Math.min(auditLog.length, 100)}
          </div>
          {auditLog.length === 0 ? (
            <EmptyState icon={FileText} title="لا سجلات بعد — نفّذ عمليات معتمدة" />
          ) : (
            <ul className="divide-y divide-line">
              {auditLog.slice(0, 100).map((a) => (
                <li key={a.auditId}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-right hover:bg-canvas"
                    onClick={() => setDetailId(a.auditId)}
                  >
                    <div>
                      <p className="font-black">{a.summary || `${a.action} · ${a.entityType}`}</p>
                      <p className="text-xs text-muted">
                        {formatDate(a.createdAt.slice(0, 10))} · {a.entityId}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        a.status === "success" ? "bg-good-soft text-good" : "bg-warn-soft text-warn"
                      }`}
                    >
                      {a.status === "success" ? "نجحت" : a.status || "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetailId(null)} title="تفاصيل العملية">
        {detail ? (
          <div className="space-y-3 text-sm">
            <Row k="العملية" v={detail.summary || detail.action} />
            <Row k="الكيان" v={`${detail.entityType} / ${detail.entityId}`} />
            <Row k="Operation ID" v={detail.operationId || "—"} />
            <Row k="Audit ID" v={detail.auditId} />
            <Row k="الجهاز" v={detail.deviceId || "—"} />
            <Row k="التاريخ" v={detail.createdAt} />
            <Row k="الحالة" v={detail.status || "—"} />
            <p className="text-xs text-muted">يُعرض فقط ما هو محفوظ في سجل التدقيق المحلي.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-muted">{title}</p>
      <p className="mt-2 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2">
      <span className="text-muted">{k}</span>
      <span className="font-bold text-ink break-all text-left">{v}</span>
    </div>
  );
}
