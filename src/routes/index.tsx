import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Calculator,
  CreditCard,
  Package,
  PieChart,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { cashBalance } from "@/lib/accounting";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatLongDate, formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const inventory = useStore((s) => s.inventory);
  const invoices = useStore((s) => s.invoices);
  const transactions = useStore((s) => s.transactions);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const now = new Date();
    const sales = invoices.filter((i) => i.type === "sale" && i.isApproved);
    const todayInvs = sales.filter((i) => new Date(i.date).toDateString() === today);
    const monthInvs = sales.filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const product = (list: typeof sales) =>
      list.filter((i) => i.invoiceType !== "SERVICE").reduce((s, i) => s + i.total, 0);
    const service = (list: typeof sales) =>
      list.filter((i) => i.invoiceType === "SERVICE").reduce((s, i) => s + i.total, 0);
    const receivables = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const payables = suppliers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const low = inventory.filter((i) => i.quantity <= (i.minQuantity || 0)).length;
    return {
      receivables,
      payables,
      todaySales: product(todayInvs),
      todayServices: service(todayInvs),
      todayCount: todayInvs.length,
      monthSales: product(monthInvs),
      monthServices: service(monthInvs),
      monthCount: monthInvs.length,
      cash: cashBalance(transactions),
      low,
    };
  }, [customers, suppliers, inventory, invoices, transactions]);

  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-muted">{formatLongDate()}</p>
          <h1 className="page-title">أهلاً بك في المعمل</h1>
        </div>
      </div>

      <Link
        to="/parties"
        className="relative block overflow-hidden rounded-3xl bg-brand p-6 text-brand-fg shadow-lg"
      >
        <div className="pointer-events-none absolute -left-8 -top-10 size-40 rounded-full bg-accent/30" />
        <div className="relative">
          <p className="text-sm font-bold opacity-90">ديون العملاء المعلقة</p>
          <p className="mt-2 flex items-end justify-end gap-2">
            <span className="text-2xl font-bold">ر.ي</span>
            <span className="text-5xl font-black tabular-nums leading-none">
              {formatMoney(stats.receivables)}
            </span>
          </p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-brand-fg/15 border-t border-brand-fg/15 pt-4">
            <StatMini icon={Users} value={customers.length} label="عملاء" />
            <StatMini icon={Package} value={suppliers.length} label="موردين" />
            <StatMini icon={Wallet} value={formatMoney(stats.cash)} label="الصندوق" />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          to="/sales"
          title="مبيعات اليوم"
          value={stats.todaySales + stats.todayServices}
          hint={`${stats.todayCount} فاتورة`}
          icon={TrendingUp}
        />
        <Kpi
          to="/reports"
          title="مبيعات الشهر"
          value={stats.monthSales + stats.monthServices}
          hint={`${stats.monthCount} فاتورة`}
          icon={PieChart}
        />
        <Kpi
          to="/parties"
          title="مستحقات الموردين"
          value={stats.payables}
          hint="آجل المشتريات"
          icon={Users}
        />
        <Kpi
          to="/inventory"
          title="مواد منخفضة"
          value={stats.low}
          hint="تحتاج تزويد"
          icon={Boxes}
          raw
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Action to="/sales" icon={ShoppingBag} title="فاتورة مبيعات" />
        <Action to="/vouchers" icon={Receipt} title="سند قبض" />
        <Action to="/parties" icon={UserPlus} title="إضافة عميل" />
        <Action to="/expenses" icon={CreditCard} title="إضافة مصروف" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <Link to="/reports" className="text-sm font-bold text-brand">
            جميع المعاملات
          </Link>
          <h2 className="flex items-center gap-2 text-lg font-black">
            آخر العمليات
            <span className="size-2 rounded-full bg-brand" />
          </h2>
        </div>
        <div className="space-y-2">
          {recent.length === 0 ? (
            <div className="card px-4 py-10 text-center text-muted">لا توجد عمليات مسجلة</div>
          ) : (
            recent.map((trx) => {
              const inflow = trx.cashIn > 0 || trx.credit > trx.debit;
              const amount = trx.cashIn || trx.cashOut || trx.debit || trx.credit;
              return (
                <div key={trx.id} className="card flex items-center gap-3 p-3">
                  <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${inflow ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
                  >
                    {inflow ? (
                      <ArrowDownRight className="size-6" />
                    ) : (
                      <ArrowUpRight className="size-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{trx.description}</p>
                    <p className="text-xs text-muted">
                      {formatDate(trx.date)} · {trx.documentNumber}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-left text-base font-black tabular-nums ${inflow ? "text-good" : "text-bad"}`}
                    dir="ltr"
                  >
                    {inflow ? "+" : "-"}
                    {formatMoney(amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function StatMini({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
}) {
  return (
    <div className="px-1 text-center">
      <Icon className="mx-auto mb-1 size-4 opacity-80" />
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-bold opacity-80">{label}</p>
    </div>
  );
}

function Kpi({
  to,
  title,
  value,
  hint,
  icon: Icon,
  raw,
}: {
  to: string;
  title: string;
  value: number;
  hint: string;
  icon: typeof TrendingUp;
  raw?: boolean;
}) {
  return (
    <Link to={to} className="card flex flex-col items-end p-4 transition hover:bg-canvas">
      <div className="mb-3 flex w-full items-center justify-between text-muted">
        <Calculator className="size-4 opacity-0" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{title}</span>
          <span className="rounded-lg bg-brand-soft p-1.5 text-brand">
            <Icon className="size-4" />
          </span>
        </div>
      </div>
      <p className="mb-2 text-2xl font-black tabular-nums text-ink">
        {raw ? value : formatCurrency(value)}
      </p>
      <span className="rounded-xl bg-brand-soft px-3 py-1 text-xs font-bold text-brand">{hint}</span>
    </Link>
  );
}

function Action({
  to,
  icon: Icon,
  title,
}: {
  to: string;
  icon: typeof ShoppingBag;
  title: string;
}) {
  return (
    <Link
      to={to}
      className="card flex flex-col items-center gap-3 p-5 transition hover:bg-canvas active:scale-[0.98]"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-6" />
      </div>
      <span className="text-sm font-bold">{title}</span>
    </Link>
  );
}
