import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Boxes,
  Calculator,
  CreditCard,
  Package,
  PieChart,
  Receipt,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { cashBalance } from "@/lib/accounting";
import { PRODUCT_SALES } from "@/lib/features";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatLongDate, formatMoney } from "@/lib/utils";
import { Alert, Chip, Money, SectionCard, StatCard, StatGrid, toneTile } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/")({ component: Dashboard });

const SERVICE_LABEL = PRODUCT_SALES ? "المبيعات" : "خدمات التطريز";

function Dashboard() {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const inventory = useStore((s) => s.inventory);
  const invoices = useStore((s) => s.invoices);
  const transactions = useStore((s) => s.transactions);
  const settings = useStore((s) => s.settings);
  const pendingReceipts = invoices.filter(
    (i) => i.type === "purchase" && i.partyId === "PENDING_RECEIPT" && !i.isApproved,
  );

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
    const creditors = customers.filter((c) => c.balance > 0).length;
    return {
      receivables,
      payables,
      creditors,
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

  const recent = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            String(b.date).localeCompare(String(a.date)) ||
            String(b.id || "").localeCompare(String(a.id || "")),
        )
        .slice(0, 7),
    [transactions],
  );

  const serviceShare =
    stats.monthSales + stats.monthServices > 0
      ? Math.round((stats.monthServices / (stats.monthSales + stats.monthServices)) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* ————— الترحيب ————— */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-wide text-brand">{formatLongDate()}</p>
          <h1 className="page-title mt-1">أهلاً بك في {settings.name || "المعمل"}</h1>
          <p className="page-subtitle">
            نظرة سريعة على الحركة المالية والمخزون و{SERVICE_LABEL} اليوم.
          </p>
        </div>
        <Chip tone="brand" icon={Sparkles}>
          {stats.todayCount} مستند اليوم
        </Chip>
      </div>

      {/* ————— بطاقة الذمم ————— */}
      <Link to="/parties" className="card-hero block p-5 transition hover:shadow-lift sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-14 size-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -right-6 size-36 rounded-full bg-black/10" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-wide opacity-85">ديون العملاء المعلقة</p>
              <p className="mt-2 flex items-end justify-end gap-2">
                <span className="pb-1 text-sm font-bold opacity-85">ر.ي</span>
                <Money value={formatMoney(stats.receivables)} className="text-4xl sm:text-5xl" />
              </p>
              <p className="mt-1.5 text-[11px] font-bold opacity-80">
                على {stats.creditors} عميل لديهم رصيد غير مسدَّد
              </p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <TrendingUp className="size-6" />
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-white/15 border-t border-white/15 pt-4">
            <HeroStat icon={Users} value={customers.length} label="عميل" />
            <HeroStat icon={Package} value={suppliers.length} label="مورد" />
            <HeroStat icon={Wallet} value={formatMoney(stats.cash)} label="الصندوق" />
          </div>
        </div>
      </Link>

      {/* ————— مؤشرات سريعة ————— */}
      <StatGrid>
        <StatCard
          label="حركة اليوم"
          value={formatCurrency(stats.todaySales + stats.todayServices)}
          hint={`${stats.todayCount} مستند`}
          icon={Calculator}
          tone="brand"
          to="/sales"
        />
        <StatCard
          label={PRODUCT_SALES ? "مبيعات الشهر" : "خدمات الشهر"}
          value={formatCurrency(stats.monthServices + stats.monthSales)}
          hint={`${stats.monthCount} فاتورة · ${serviceShare}% خدمات`}
          icon={PieChart}
          tone="navy"
          to="/reports"
        />
        <StatCard
          label="مستحقات الموردين"
          value={formatCurrency(stats.payables)}
          hint="آجل المشتريات"
          icon={Users}
          tone="accent"
          to="/parties"
        />
        <StatCard
          label="مواد تحت الحد"
          value={stats.low}
          hint={stats.low > 0 ? "تحتاج تزويد" : "المخزون جيد"}
          icon={Boxes}
          tone={stats.low > 0 ? "bad" : "good"}
          to="/inventory"
        />
      </StatGrid>

      {/* ————— تنبيهات ————— */}
      {pendingReceipts.length > 0 ? (
        <Alert
          tone="warn"
          icon={Package}
          title={`${pendingReceipts.length} أمر توريد بانتظار المطابقة`}
          action={
            <Link to="/sales" className="btn-ghost btn-sm">
              فتح
            </Link>
          }
        >
          أضف المورد والأسعار والتكلفة ثم اعتمد فاتورة المشتريات.
        </Alert>
      ) : null}

      {stats.low > 0 ? (
        <Alert
          tone="bad"
          icon={Boxes}
          title={`${stats.low} صنف وصل للحد الأدنى`}
          action={
            <Link to="/inventory" className="btn-ghost btn-sm">
              مراجعة المخزن
            </Link>
          }
        >
          راجع الكميات قبل أن ينفد الخيط أو الأقمشة المطلوبة لخدمات التطريز.
        </Alert>
      ) : null}

      {/* ————— اختصارات ————— */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction
          to="/sales"
          icon={Calculator}
          title={PRODUCT_SALES ? "فاتورة مبيعات" : "فاتورة خدمة تطريز"}
          subtitle="تسجيل خدمة جديدة"
          tone="brand"
        />
        <QuickAction to="/vouchers" icon={Receipt} title="سند قبض/صرف" subtitle="حركة على الذمم" tone="good" />
        <QuickAction to="/parties" icon={UserPlus} title="إضافة عميل" subtitle="جهة جديدة" tone="accent" />
        <QuickAction to="/expenses" icon={CreditCard} title="إضافة مصروف" subtitle="تسجيل مصروف" tone="bad" />
      </div>

      {/* ————— آخر العمليات ————— */}
      <SectionCard
        title="آخر العمليات"
        subtitle="أحدث الحركات المسجّلة في الدفاتر"
        icon={Receipt}
        action={
          <Link to="/cashbox" className="text-xs font-black text-brand hover:underline">
            عرض الصندوق
          </Link>
        }
        bodyClassName="p-2 sm:p-3"
      >
        {recent.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-canvas text-muted">
              <Receipt className="size-6" />
            </span>
            <p className="mt-3 font-black text-ink">لا توجد عمليات مسجلة بعد</p>
            <p className="mt-1 text-sm text-muted">ابدأ بفاتورة خدمة تطريز أو سند قبض من الاختصارات أعلاه.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((trx, i) => {
              const inflow = trx.cashIn > 0 || trx.credit > trx.debit;
              const amount = trx.cashIn || trx.cashOut || trx.debit || trx.credit;
              return (
                <div key={`${trx.id}-${i}`} className="list-row">
                  <span
                    className={cn(
                      "tile-icon",
                      inflow ? "bg-good-soft text-good" : "bg-bad-soft text-bad",
                    )}
                  >
                    {inflow ? (
                      <ArrowDownLeft className="size-5" />
                    ) : (
                      <ArrowUpLeft className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{trx.description}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-muted">
                      {formatDate(trx.date)}
                      {trx.documentNumber ? ` · ${trx.documentNumber}` : ""}
                    </p>
                  </div>
                  <Money
                    value={`${inflow ? "+" : "−"}${formatMoney(amount)}`}
                    tone={inflow ? "good" : "bad"}
                    className="shrink-0 text-sm"
                  />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function HeroStat({
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
      <Icon className="mx-auto mb-1 size-4 opacity-85" />
      <p className="num text-base font-black sm:text-lg">{value}</p>
      <p className="text-[10px] font-bold opacity-80">{label}</p>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
  tone: "brand" | "good" | "accent" | "bad";
}) {
  return (
    <Link to={to} className="card card-hover flex flex-col gap-3 p-4 active:scale-[0.98]">
      <span className={cn("tile-icon size-10", toneTile(tone))}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] font-bold text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}
