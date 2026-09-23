import { createLazyFileRoute } from "@tanstack/react-router";
import {
  Briefcase,
  CreditCard,
  Layers,
  Plus,
  Receipt,
  Tag,
  Trash2,
  User,
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
  Meter,
  Money,
  PageHeader,
  SearchField,
  SectionCard,
  Segmented,
  StatCard,
  StatGrid,
} from "@/components/ui/kit";
import { cashBalance } from "@/lib/accounting";
import { expenseCategories, expenseKindLabel, methodLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { ExpenseKind, PaymentMethod } from "@/lib/types";
import { formatMoney, todayIso } from "@/lib/utils";

export const Route = createLazyFileRoute("/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const expenses = useStore((s) => s.expenses);
  const transactions = useStore((s) => s.transactions);
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);

  const [tab, setTab] = useState<ExpenseKind>("work");
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExpenseKind>("work");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(expenseCategories[0]);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayIso());

  const kindExpenses = useMemo(() => expenses.filter((e) => e.type === tab), [expenses, tab]);

  const filtered = useMemo(
    () =>
      kindExpenses
        .filter((e) => (categoryFilter ? e.category === categoryFilter : true))
        .filter((e) => !q || e.description.includes(q) || e.category.includes(q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [kindExpenses, categoryFilter, q],
  );

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const kindTotal = kindExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    kindExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [kindExpenses]);

  const topCategory = byCategory[0];
  const maxCategory = topCategory ? topCategory[1] : 0;

  const availableCash = cashBalance(transactions, method);

  const save = () => {
    const n = Number.parseFloat(amount) || 0;
    if (n <= 0 || !category) {
      toast.error("أدخل المبلغ والتصنيف");
      return;
    }
    const bal = cashBalance(transactions, method);
    if (n > bal) {
      toast.error(`رصيد ${methodLabel[method]} غير كافٍ (${formatMoney(bal)})`);
      return;
    }
    addExpense({
      date,
      category,
      type,
      description,
      amount: n,
      paymentMethod: method,
    });
    toast.success("تم تسجيل المصروف");
    setOpen(false);
    setAmount("");
    setDescription("");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="المصروفات"
        subtitle="مصاريف العمل والمصروفات الشخصية — مصنّفة حسب الفئة."
        icon={CreditCard}
        tone="bad"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setType(tab);
              setOpen(true);
            }}
          >
            <Plus className="size-5" />
            مصروف جديد
          </button>
        }
      />

      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          setCategoryFilter("");
        }}
        options={[
          { value: "work" as ExpenseKind, label: expenseKindLabel.work, icon: Briefcase },
          { value: "personal" as ExpenseKind, label: expenseKindLabel.personal, icon: User },
        ]}
        className="sm:max-w-md"
      />

      <StatGrid cols={3}>
        <StatCard
          label={`إجمالي ${expenseKindLabel[tab]}`}
          value={formatMoney(kindTotal)}
          icon={Wallet}
          tone="bad"
          hint={`${kindExpenses.length} مصروف`}
        />
        <StatCard
          label="إجمالي المعروض"
          value={formatMoney(total)}
          icon={Receipt}
          tone="navy"
          hint={categoryFilter ? `مصنّف: ${categoryFilter}` : "كل الفئات"}
        />
        <StatCard
          label="أكبر فئة"
          value={topCategory ? topCategory[0] : "—"}
          icon={Tag}
          tone="warn"
          hint={topCategory ? formatMoney(topCategory[1]) : "لا توجد بيانات"}
        />
      </StatGrid>

      {byCategory.length > 0 ? (
        <SectionCard
          title="التوزيع حسب الفئة"
          subtitle="أين تذهب المصروفات فعليًا"
          icon={Layers}
          tone="accent"
          action={
            categoryFilter ? (
              <button
                type="button"
                className="text-xs font-black text-brand hover:underline"
                onClick={() => setCategoryFilter("")}
              >
                إلغاء التصفية
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            {byCategory.map(([name, value]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === name ? "" : name)}
                className="block w-full text-right"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-ink">{name}</span>
                  <Money value={formatMoney(value)} className="text-xs text-ink" />
                </div>
                <Meter
                  value={value}
                  max={maxCategory}
                  tone={categoryFilter === name ? "brand" : "accent"}
                  className="mt-1.5"
                />
              </button>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="card space-y-3 p-3 sm:p-4">
        <SearchField value={q} onChange={setQ} placeholder="ابحث بالبيان أو التصنيف…" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!categoryFilter} onClick={() => setCategoryFilter("")}>
            كل الفئات
          </FilterChip>
          {expenseCategories.slice(0, 8).map((c) => (
            <FilterChip
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(categoryFilter === c ? "" : c)}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="لا توجد مصروفات مطابقة"
            hint="جرّب فئة أخرى أو سجّل مصروفًا جديدًا."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <article key={e.id} className="list-row group">
              <span className="tile-icon bg-bad-soft text-bad">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-ink">{e.category}</p>
                  <Chip tone="muted">{methodLabel[e.paymentMethod]}</Chip>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-bold text-muted">
                  {e.date} · {e.description || "بلا بيان"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Money value={formatMoney(e.amount)} tone="bad" className="text-sm" />
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-xl bg-bad-soft text-bad opacity-100 transition-opacity hover:bg-bad/15 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="حذف المصروف"
                  onClick={() => {
                    if (confirm("حذف المصروف؟")) {
                      deleteExpense(e.id);
                      toast.success("تم الحذف");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title="مصروف جديد"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              حفظ المصروف
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div>
            <span className="label">نوع المصروف</span>
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: "work" as ExpenseKind, label: expenseKindLabel.work, icon: Briefcase },
                { value: "personal" as ExpenseKind, label: expenseKindLabel.personal, icon: User },
              ]}
            />
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
            <span className="field-hint">
              المتاح في {methodLabel[method]}: {formatMoney(availableCash)}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">التصنيف</span>
              <AppSelect
                value={category}
                onChange={setCategory}
                options={expenseCategories.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <span className="label">طريقة الدفع</span>
              <AppSelect
                value={method}
                onChange={(v) => setMethod(v as PaymentMethod)}
                options={Object.entries(methodLabel).map(([value, label]) => ({ value, label }))}
                searchable={false}
              />
            </div>
          </div>

          <AppDatePicker value={date} onChange={setDate} label="التاريخ" />

          <label>
            <span className="label">البيان</span>
            <input
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: فاتورة كهرباء الورشة"
            />
          </label>

          {Number.parseFloat(amount) > availableCash ? (
            <Alert tone="bad" icon={Wallet} title="المبلغ أكبر من الرصيد المتاح">
              رصيد {methodLabel[method]} الحالي {formatMoney(availableCash)}.
            </Alert>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
