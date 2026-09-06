import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cashBalance } from "@/lib/accounting";
import { statusLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { daysAgoIso, formatCurrency, formatDate, formatMoney, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const invoices = useStore((s) => s.invoices);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const transactions = useStore((s) => s.transactions);
  const inventory = useStore((s) => s.inventory);
  const expenses = useStore((s) => s.expenses);
  const settings = useStore((s) => s.settings);

  const [tab, setTab] = useState<"sales" | "parties" | "stock">("sales");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [customerId, setCustomerId] = useState("all");

  const sales = useMemo(() => {
    return invoices.filter((i) => {
      if (i.type !== "sale" || !i.isApproved) return false;
      if (i.date < from || i.date > to) return false;
      if (customerId !== "all" && i.partyId !== customerId) return false;
      return true;
    });
  }, [invoices, from, to, customerId]);

  const salesTotal = sales.reduce((s, i) => s + i.total, 0);
  const services = sales.filter((i) => i.invoiceType === "SERVICE").reduce((s, i) => s + i.total, 0);
  const products = salesTotal - services;
  const collected = sales.reduce((s, i) => s + i.paidAmount, 0);

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (let n = 6; n >= 0; n--) {
      map.set(daysAgoIso(n), 0);
    }
    for (const inv of invoices) {
      if (inv.type === "sale" && inv.isApproved && map.has(inv.date)) {
        map.set(inv.date, (map.get(inv.date) || 0) + inv.total);
      }
    }
    return [...map.entries()].map(([date, total]) => ({
      date: date.slice(5),
      total,
    }));
  }, [invoices]);

  const stockValue = inventory.reduce((s, i) => s + i.quantity * i.costPrice, 0);

  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchFrom = !from || t.date >= from;
      const matchTo = !to || t.date <= to;
      return matchFrom && matchTo;
    });
  }, [transactions, from, to]);

  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchFrom = !from || e.date >= from;
      const matchTo = !to || e.date <= to;
      return matchFrom && matchTo;
    });
  }, [expenses, from, to]);

  const periodCashIn = periodTransactions.reduce((s, t) => s + (t.cashIn || 0), 0);
  const periodCashOut = periodTransactions.reduce((s, t) => s + (t.cashOut || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="page-subtitle">{settings.name}</p>
        </div>
        <button type="button" className="btn-ghost no-print" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-paper p-1 shadow-sm">
        {(
          [
            ["sales", "المبيعات"],
            ["parties", "الأرصدة"],
            ["stock", "المخزن"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold ${tab === k ? "bg-brand text-brand-fg" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sales" ? (
        <div className="print-section space-y-4">
          <div className="card grid gap-3 p-3 sm:grid-cols-3">
            <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <select className="input-field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="all">كل العملاء</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="إجمالي المبيعات" value={salesTotal} />
            <Mini label="بضاعة" value={products} />
            <Mini label="تطريز" value={services} />
            <Mini label="محصّل" value={collected} />
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-black">مبيعات آخر 7 أيام</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatMoney(Number(v))} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Bar dataKey="total" fill="var(--color-brand)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            {sales.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">لا توجد فواتير في الفترة.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <th className="px-3 py-2 text-right">رقم</th>
                    <th className="px-3 py-2 text-right">العميل</th>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-left">المبلغ</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((i) => (
                    <tr key={i.id} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-xs">{i.invoiceNumber}</td>
                      <td className="px-3 py-2 font-bold">
                        {customers.find((c) => c.id === i.partyId)?.name}
                      </td>
                      <td className="px-3 py-2">{formatDate(i.date)}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(i.total)}</td>
                      <td className="px-3 py-2">{statusLabel[i.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {tab === "parties" ? (
        <div className="print-section space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Mini
              label="ديون العملاء"
              value={customers.reduce((s, c) => s + Math.max(0, c.balance), 0)}
            />
            <Mini
              label="مستحقات الموردين"
              value={suppliers.reduce((s, c) => s + Math.max(0, c.balance), 0)}
            />
          </div>
          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 font-black">
              <FileText className="size-4 text-brand" />
              أعلى المديونيات
            </h3>
            <ul className="space-y-2">
              {[...customers]
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 8)
                .map((c) => (
                  <li key={c.id} className="flex justify-between text-sm">
                    <span className="font-bold">{c.name}</span>
                    <span className="tabular-nums text-accent">{formatCurrency(c.balance)}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-2 font-black">رصيد الصندوق</h3>
            <p className="text-3xl font-black tabular-nums">{formatCurrency(cashBalance(periodTransactions))}</p>
            <div className="mt-1 flex gap-4 text-sm text-muted">
              <span>قبض الفترة: {formatCurrency(periodCashIn)}</span>
              <span>صرف الفترة: {formatCurrency(periodCashOut)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              مصروفات الفترة: {formatCurrency(periodExpenses.reduce((s, e) => s + e.amount, 0))}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "stock" ? (
        <div className="print-section space-y-4">
          <Mini label="قيمة المخزن بالتكلفة" value={stockValue} />
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-muted">
                  <th className="px-3 py-2 text-right">المادة</th>
                  <th className="px-3 py-2 text-center">الكمية</th>
                  <th className="px-3 py-2 text-left">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-3 py-2 font-bold">
                      {i.name}
                      {i.quantity <= i.minQuantity ? (
                        <span className="mr-2 text-xs text-bad">منخفض</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{i.quantity}</td>
                    <td className="px-3 py-2 text-left tabular-nums">
                      {formatCurrency(i.quantity * i.costPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}
