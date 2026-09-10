import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer, Search, RefreshCw } from "lucide-react";
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
type AnyRow = Record<string, any>;

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(value: unknown): string {
  return String(value ?? "").slice(0, 10);
}

function ReportsPage() {
  const invoices = useStore((s) => arrayOrEmpty<AnyRow>(s.invoices));
  const customers = useStore((s) => arrayOrEmpty<AnyRow>(s.customers));
  const suppliers = useStore((s) => arrayOrEmpty<AnyRow>(s.suppliers));
  const transactions = useStore((s) => arrayOrEmpty<AnyRow>(s.transactions));
  const inventory = useStore((s) => arrayOrEmpty<AnyRow>(s.inventory));
  const warehouseStocks = useStore((s) => arrayOrEmpty<AnyRow>(s.warehouseStocks));
  const expenses = useStore((s) => arrayOrEmpty<AnyRow>(s.expenses));
  const vouchers = useStore((s) => arrayOrEmpty<AnyRow>(s.vouchers));
  const warehouses = useStore((s) => arrayOrEmpty<AnyRow>(s.warehouses));
  const auditLog = useStore((s) => arrayOrEmpty<AnyRow>(s.auditLog));
  const connectionState = useStore((s) => s.connectionState);
  const fetchFromDb = useStore((s) => s.fetchFromDb);

  const [tab, setTab] = useState<ReportTab>("overview");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [partyId, setPartyId] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState("");

  const refresh = async () => {
    setRefreshing(true);
    setDataError("");
    try {
      await fetchFromDb();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "تعذر تحديث بيانات التقارير");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [fetchFromDb]);

  const inRange = (date: unknown) => {
    const day = dateOnly(date);
    return Boolean(day) && day >= from && day <= to;
  };

  const sales = useMemo(
    () => invoices.filter((i) => i.type === "sale" && i.isApproved && !i.isCancelled && inRange(i.date) && (partyId === "all" || i.partyId === partyId)),
    [invoices, from, to, partyId],
  );

  const salesTotal = useMemo(() => sales.reduce((sum, i) => sum + money(i.total), 0), [sales]);
  const collected = useMemo(() => sales.reduce((sum, i) => sum + money(i.paidAmount), 0), [sales]);
  const expenseTotal = useMemo(() => expenses.filter((e) => inRange(e.date)).reduce((sum, e) => sum + money(e.amount), 0), [expenses, from, to]);
  const receipts = useMemo(() => vouchers.filter((v) => v.type === "receipt" && inRange(v.date)).reduce((sum, v) => sum + money(v.amount), 0), [vouchers, from, to]);

  const cash = useMemo(() => {
    const normalized = transactions.map((t) => ({
      ...t,
      debit: money(t.debit),
      credit: money(t.credit),
      cashIn: money(t.cashIn),
      cashOut: money(t.cashOut),
    }));
    return money(cashBalance({ transactions: normalized } as any));
  }, [transactions]);

  const partyLedger = useMemo(() => {
    if (partyId === "all") return [];
    return transactions
      .filter((t) => t.partyId === partyId)
      .sort((a, b) => dateOnly(a.date).localeCompare(dateOnly(b.date)) || String(a.id).localeCompare(String(b.id)));
  }, [transactions, partyId]);

  const partyRunning = useMemo(() => {
    let balance = 0;
    return partyLedger.map((t) => {
      const debit = money(t.debit);
      const credit = money(t.credit);
      balance += debit - credit;
      return { ...t, debit, credit, running: balance };
    });
  }, [partyLedger]);

  const partyBalance = partyRunning.length ? money(partyRunning[partyRunning.length - 1].running) : 0;

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    const cappedEnd = new Date(end);
    const maxDays = 31;
    const span = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (span > maxDays) cappedEnd.setTime(start.getTime() + (maxDays - 1) * 86400000);
    for (const inv of sales) {
      const day = dateOnly(inv.date);
      if (day) map.set(day, money(map.get(day)) + money(inv.total));
    }
    const rows: { date: string; total: number }[] = [];
    for (let d = new Date(start); d <= cappedEnd; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      rows.push({ date: day.slice(5), total: money(map.get(day)) });
    }
    return rows;
  }, [sales, from, to]);

  const stockRows = useMemo(() => {
    return inventory
      .filter((i) => !q || String(i.name ?? "").toLowerCase().includes(q.toLowerCase()))
      .map((i) => {
        const quantity = warehouseId === "all"
          ? money(i.quantity)
          : warehouseStocks.filter((s) => s.productId === i.id && s.warehouseId === warehouseId).reduce((sum, s) => sum + money(s.quantity), 0);
        const minQuantity = money(i.minQuantity);
        return {
          ...i,
          quantity,
          costPrice: money(i.costPrice),
          status: quantity <= 0 ? "نفد" : quantity <= minQuantity ? "منخفض" : "متوفر",
        };
      })
      .filter((i) => warehouseId === "all" || i.quantity > 0 || warehouseStocks.some((s) => s.productId === i.id && s.warehouseId === warehouseId));
  }, [inventory, q, warehouseId, warehouseStocks]);

  const stockValue = useMemo(() => stockRows.reduce((sum, i) => sum + money(i.quantity) * money(i.costPrice), 0), [stockRows]);

  const partyOptions = [
    { value: "all", label: "كل الأطراف" },
    ...customers.map((c) => ({ value: String(c.id), label: String(c.name), description: "عميل" })),
    ...suppliers.map((s) => ({ value: String(s.id), label: String(s.name), description: "مورد" })),
  ];

  const warehouseOptions = [
    { value: "all", label: "كل المخازن" },
    ...warehouses.filter((w) => w.isActive).map((w) => ({ value: String(w.id), label: String(w.name) })),
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
  const isInitialLoading = connectionState === "syncing" && !invoices.length && !customers.length && !inventory.length;
  const invalidRange = from > to;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="text-sm text-muted">من مصادر الحقيقة: القيود · الحركات · المستندات</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            <Printer className="size-4" />طباعة
          </button>
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AppDatePicker label="من تاريخ" value={from} onChange={setFrom} />
          <AppDatePicker label="إلى تاريخ" value={to} onChange={setTo} />
          <AppSelect label="الطرف" value={partyId} onChange={setPartyId} options={partyOptions} searchable />
          <AppSelect label="المخزن" value={warehouseId} onChange={setWarehouseId} options={warehouseOptions} searchable={false} />
        </div>
        {invalidRange && <p className="rounded-xl bg-bad/10 px-3 py-2 text-xs font-bold text-bad">تاريخ البداية يجب أن يكون قبل تاريخ النهاية.</p>}
        {dataError && <p className="rounded-xl bg-bad/10 px-3 py-2 text-xs font-bold text-bad">تعذر تحديث البيانات: {dataError}</p>}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => <button key={t.id} type="button" disabled={invalidRange} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${tab === t.id ? "bg-brand text-brand-fg" : "bg-canvas text-muted hover:bg-brand-soft"}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
      </div>

      {isInitialLoading ? <div className="card p-8 text-center text-sm font-bold text-muted" role="status">جاري تحميل بيانات التقارير…</div> : null}

      {tab === "overview" && !invalidRange && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi title="مبيعات الفترة" value={formatCurrency(salesTotal)} />
            <Kpi title="المقبوض (فواتير)" value={formatCurrency(collected)} />
            <Kpi title="سندات قبض" value={formatCurrency(receipts)} />
            <Kpi title="مصروفات" value={formatCurrency(expenseTotal)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi title="رصيد الصندوق (من القيود)" value={formatCurrency(cash)} />
            <Kpi title={`قيمة المخزون (${warehouseId === "all" ? "كل المخازن" : "المخزن المختار"})`} value={formatCurrency(stockValue)} />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-black">المبيعات اليومية</h2>
            {chart.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={48} /><Tooltip formatter={(v: number) => formatMoney(money(v))} /><Bar dataKey="total" fill="var(--color-brand)" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={FileText} title="لا توجد مبيعات في الفترة المحددة" />}
            {to > from && chart.length === 31 && <p className="mt-2 text-[11px] text-muted">يعرض الرسم أول 31 يومًا من الفترة المحددة؛ الجداول والملخصات تشمل كامل الفترة.</p>}
          </div>
        </>
      )}

      {tab === "sales" && !invalidRange && <div className="card overflow-hidden"><div className="border-b border-line px-4 py-3 text-sm font-bold text-muted">{sales.length} فاتورة · الإجمالي {formatCurrency(salesTotal)}</div>{sales.length === 0 ? <EmptyState icon={FileText} title="لا مبيعات في الفترة" /> : <ul className="divide-y divide-line">{sales.map((inv) => <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-black">{inv.invoiceNumber}</p><p className="text-xs text-muted">{formatDate(inv.date)} · {customers.find((c) => c.id === inv.partyId)?.name || inv.partyId}</p></div><p className="font-black tabular-nums">{formatCurrency(money(inv.total))}</p></li>)}</ul>}</div>}

      {tab === "cash" && !invalidRange && <div className="card overflow-hidden"><div className="border-b border-line px-4 py-3 text-sm font-bold">حركة الصندوق من القيود · الرصيد {formatCurrency(cash)}</div><ul className="divide-y divide-line">{transactions.filter((t) => (money(t.cashIn) || money(t.cashOut)) && inRange(t.date)).slice(0, 100).map((t) => <li key={t.id} className="flex justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-bold">{t.description}</p><p className="text-xs text-muted">{formatDate(t.date)}</p></div><p className={`font-black tabular-nums ${money(t.cashIn) ? "text-good" : "text-bad"}`}>{money(t.cashIn) ? `+${formatCurrency(money(t.cashIn))}` : `-${formatCurrency(money(t.cashOut))}`}</p></li>)}></ul></div>}

      {tab === "stock" && !invalidRange && <div className="space-y-3"><div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="input-field pr-10" placeholder="بحث صنف…" value={q} onChange={(e) => setQ(e.target.value)} /></div><p className="text-xs text-muted">الأرصدة حسب المخزن من warehouse_stock. اختيار «كل المخازن» يجمع الكميات.</p><div className="card overflow-hidden"><ul className="divide-y divide-line">{stockRows.map((i) => <li key={i.id} className="flex items-center justify-between px-4 py-3"><div><p className="font-black">{i.name}</p><p className="text-xs text-muted">{i.category}</p></div><div className="text-left"><p className="font-black tabular-nums">{i.quantity}</p><span className={`text-xs font-bold ${i.status === "نفد" ? "text-bad" : i.status === "منخفض" ? "text-warn" : "text-good"}`}>{i.status}</span></div></li>)}{!stockRows.length && <li><EmptyState icon={Search} title="لا توجد أصناف مطابقة" /></li>}</ul></div></div>}

      {tab === "party" && !invalidRange && <div className="space-y-3">{partyId === "all" ? <div className="card p-6"><EmptyState icon={FileText} title="اختر عميلاً أو مورداً لعرض كشف الحساب" /></div> : <><div className="card p-4"><p className="text-sm text-muted">حساب مفتوح — الدفعات غير مربوطة بفاتورة</p><p className="mt-1 text-2xl font-black tabular-nums">{formatCurrency(partyBalance)}</p></div><div className="card overflow-hidden"><div className="grid grid-cols-5 gap-1 border-b border-line bg-canvas px-3 py-2 text-[11px] font-bold text-muted"><span>التاريخ</span><span className="col-span-2">البيان</span><span>مدين</span><span>دائن</span></div>{partyRunning.length === 0 ? <p className="p-4 text-sm text-muted">لا حركات على هذا الحساب</p> : partyRunning.map((t) => <div key={t.id} className="grid grid-cols-5 gap-1 border-b border-line px-3 py-2 text-xs"><span className="tabular-nums text-muted">{formatDate(t.date)}</span><span className="col-span-2 font-bold">{t.description}</span><span className="tabular-nums">{t.debit ? formatCurrency(t.debit) : "—"}</span><span className="tabular-nums">{t.credit ? formatCurrency(t.credit) : "—"}</span></div>)}</div></>}</div>}

      {tab === "activity" && !invalidRange && <div className="card overflow-hidden"><div className="border-b border-line px-4 py-3 text-sm font-bold text-muted">سجل العمليات (محلي + خادم، مدمج بـ operation_id) · {Math.min(auditLog.length, 100)}</div>{auditLog.length === 0 ? <EmptyState icon={FileText} title="لا سجلات بعد — نفّذ عمليات معتمدة" /> : <ul className="divide-y divide-line">{auditLog.slice(0, 100).map((a) => <li key={a.auditId}><button type="button" className="flex w-full items-start justify-between gap-3 px-4 py-3 text-right hover:bg-canvas" onClick={() => setDetailId(a.auditId)}><div><p className="font-black">{a.summary || `${a.action} · ${a.entityType}`}</p><p className="text-xs text-muted">{formatDate(dateOnly(a.createdAt))} · {a.entityId}</p></div><span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${a.status === "success" ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{a.status === "success" ? "نجحت" : a.status || "—"}</span></button></li>)}</ul>}</div>}

      <Modal open={!!detail} onClose={() => setDetailId(null)} title="تفاصيل العملية">{detail ? <div className="space-y-3 text-sm"><Row k="العملية" v={detail.summary || detail.action} /><Row k="الكيان" v={`${detail.entityType} / ${detail.entityId}`} /><Row k="Operation ID" v={detail.operationId || "—"} /><Row k="Audit ID" v={detail.auditId} /><Row k="الجهاز" v={detail.deviceId || "—"} /><Row k="التاريخ" v={detail.createdAt} /><Row k="الحالة" v={detail.status || "—"} /></div> : null}</Modal>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return <div className="card p-4"><p className="text-xs font-bold text-muted">{title}</p><p className="mt-2 text-xl font-black tabular-nums">{value}</p></div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b border-line pb-2"><span className="text-muted">{k}</span><span className="break-all text-left font-bold text-ink">{v}</span></div>;
}
