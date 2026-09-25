import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Boxes,
  Calculator,
  ChevronDown,
  CreditCard,
  Package,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cashBalance } from "@/lib/accounting";
import { PRODUCT_SALES } from "@/lib/features";
import { useStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { cn, formatDate, formatLongDate, formatMoney } from "@/lib/utils";
import { Alert, Money, SectionCard, toneTile } from "@/components/ui/kit";

export const Route = createLazyFileRoute("/")({ component: Dashboard });

/** هل تاريخ المستند يعود لليوم الحالي؟ يقبل "YYYY-MM-DD" أو تاريخًا كاملًا. */
function isToday(value: string) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}

/** الأحدث أولًا: التاريخ ثم المعرّف (المعرّفات تحمل الجزء الزمني). */
function byNewest(a: Transaction, b: Transaction) {
  return (
    String(b.date).localeCompare(String(a.date)) ||
    String(b.id || "").localeCompare(String(a.id || ""))
  );
}

function Dashboard() {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const inventory = useStore((s) => s.inventory);
  const invoices = useStore((s) => s.invoices);
  const transactions = useStore((s) => s.transactions);
  const [todayOpen, setTodayOpen] = useState(false);

  const pendingReceipts = invoices.filter(
    (i) => i.type === "purchase" && i.partyId === "PENDING_RECEIPT" && !i.isApproved,
  );

  const stats = useMemo(() => {
    const sales = invoices.filter((i) => i.type === "sale" && i.isApproved);
    const todayInvs = sales.filter((i) => isToday(i.date));
    const sum = (list: typeof sales) => list.reduce((s, i) => s + i.total, 0);
    const receivables = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const low = inventory.filter((i) => i.quantity <= (i.minQuantity || 0)).length;
    const creditors = customers.filter((c) => c.balance > 0).length;
    return {
      receivables,
      creditors,
      todaySales: sum(todayInvs.filter((i) => i.invoiceType !== "SERVICE")),
      todayServices: sum(todayInvs.filter((i) => i.invoiceType === "SERVICE")),
      cash: cashBalance(transactions),
      low,
    };
  }, [customers, inventory, invoices, transactions]);

  /**
   * كل حركات اليوم: الدفاتر (transactions) هي سجل موحّد لكل مستند في النظام
   * (فاتورة خدمة/مبيعات، سند قبض/صرف، مصروف)، فتظهر هنا كاملة.
   */
  const todayMovements = useMemo(
    () => transactions.filter((t) => isToday(t.date)).sort(byNewest),
    [transactions],
  );

  const todayCashIn = todayMovements.reduce((s, t) => s + (t.cashIn || 0), 0);
  const todayCashOut = todayMovements.reduce((s, t) => s + (t.cashOut || 0), 0);
  const todaySalesTotal = stats.todaySales + stats.todayServices;

  const recent = useMemo(() => [...transactions].sort(byNewest).slice(0, 7), [transactions]);

  return (
    <div className="space-y-5">
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

      {/* ————— حركة اليوم: بطاقة بعرض الشاشة فوق سجل العمليات ————— */}
      <section className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setTodayOpen((open) => !open)}
          aria-expanded={todayOpen}
          aria-controls="today-movements"
          className="block w-full text-right transition-colors duration-150 hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
        >
          <span className="flex items-center gap-3 p-4 sm:p-5">
            <span className="tile-icon size-12 rounded-2xl bg-brand-soft text-brand shadow-soft">
              <Calculator className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="section-title">حركة اليوم</span>
                <span className="chip bg-brand-soft text-brand-dark">
                  {todayMovements.length} حركة
                </span>
              </span>
              <span className="mt-0.5 block text-xs font-bold text-muted">
                {formatLongDate()} · انقر لعرض كل حركات اليوم في النظام
              </span>
            </span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted">
              <ChevronDown
                className={cn("size-5 transition-transform duration-200", todayOpen && "rotate-180")}
              />
            </span>
          </span>

          <span className="grid gap-3 border-t border-line/70 p-4 sm:grid-cols-3 sm:p-5">
            <span className="card-sunken block p-3">
              <span className="block text-[11px] font-black text-muted">قبض اليوم</span>
              <Money value={formatMoney(todayCashIn)} tone="good" className="mt-1 block text-lg" />
            </span>
            <span className="card-sunken block p-3">
              <span className="block text-[11px] font-black text-muted">صرف اليوم</span>
              <Money value={formatMoney(todayCashOut)} tone="bad" className="mt-1 block text-lg" />
            </span>
            <span className="card-sunken block p-3">
              <span className="block text-[11px] font-black text-muted">
                {PRODUCT_SALES ? "مبيعات اليوم" : "خدمات اليوم"}
              </span>
              <Money value={formatMoney(todaySalesTotal)} tone="brand" className="mt-1 block text-lg" />
            </span>
          </span>
        </button>

        {todayOpen ? (
          <div id="today-movements" className="border-t border-line/70 p-3 sm:p-4">
            {todayMovements.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-canvas text-muted">
                  <Receipt className="size-6" />
                </span>
                <p className="mt-3 font-black text-ink">لا توجد حركات مسجّلة اليوم</p>
                <p className="mt-1 text-sm text-muted">
                  سجّل فاتورة خدمة تطريز أو سند قبض وستظهر هنا فورًا.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayMovements.map((trx, i) => (
                  <MovementRow key={`${trx.id}-${i}`} trx={trx} />
                ))}
              </div>
            )}

            <Link
              to="/cashbox"
              className="btn-ghost btn-sm mt-3 flex w-full items-center justify-center"
            >
              عرض الصندوق كاملًا
            </Link>
          </div>
        ) : null}
      </section>

      {/* ————— آخر العمليات ————— */}
      <SectionCard
        title="آخر العمليات"
        subtitle="أحدث الحركات المسجّلة في الدفاتر"
        icon={Receipt}
        action={
          <Link
            to="/cashbox"
            className="inline-flex min-h-11 items-center text-xs font-black text-brand hover:underline sm:min-h-0"
          >
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
            {recent.map((trx, i) => (
              <MovementRow key={`${trx.id}-${i}`} trx={trx} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/** صف حركة واحد — يُستخدم في «حركة اليوم» وفي «آخر العمليات». */
function MovementRow({ trx }: { trx: Transaction }) {
  const inflow = trx.cashIn > 0 || trx.credit > trx.debit;
  const amount = trx.cashIn || trx.cashOut || trx.debit || trx.credit;
  return (
    <div className="list-row">
      <span className={cn("tile-icon", inflow ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
        {inflow ? <ArrowDownLeft className="size-5" /> : <ArrowUpLeft className="size-5" />}
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
      <p className="text-[11px] font-bold opacity-80">{label}</p>
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
