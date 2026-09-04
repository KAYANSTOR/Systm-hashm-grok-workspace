import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { cashBalance } from "@/lib/accounting";
import { expenseCategories, expenseKindLabel, methodLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { ExpenseKind, PaymentMethod } from "@/lib/types";
import { formatCurrency, formatDate, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const expenses = useStore((s) => s.expenses);
  const transactions = useStore((s) => s.transactions);
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);

  const [tab, setTab] = useState<ExpenseKind>("work");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExpenseKind>("work");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(expenseCategories[0]);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayIso());

  const filtered = useMemo(
    () =>
      expenses
        .filter((e) => e.type === tab)
        .filter((e) => e.description.includes(q) || e.category.includes(q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, tab, q],
  );

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const save = () => {
    const n = parseFloat(amount) || 0;
    if (n <= 0 || !category) return toast.error("أدخل المبلغ والتصنيف");
    const bal = cashBalance(transactions, method);
    if (n > bal) {
      toast.error(`رصيد ${methodLabel[method]} غير كافٍ (${formatCurrency(bal)})`);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">المصروفات</h1>
          <p className="page-subtitle">مصاريف العمل والمصروفات الشخصية.</p>
        </div>
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
      </div>

      <div className="flex rounded-2xl bg-paper p-1 shadow-sm">
        {(["work", "personal"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${tab === t ? "bg-brand text-brand-fg" : "text-muted"}`}
          >
            {expenseKindLabel[t]}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <p className="text-xs font-bold text-muted">إجمالي {expenseKindLabel[tab]}</p>
        <p className="text-2xl font-black tabular-nums">{formatCurrency(total)}</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className="input-field pr-10" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={CreditCard} title="لا توجد مصروفات" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <article key={e.id} className="card flex items-center gap-3 p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-bad-soft text-bad">
                <CreditCard className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{e.category}</p>
                <p className="truncate text-xs text-muted">
                  {formatDate(e.date)} · {methodLabel[e.paymentMethod]} · {e.description || "—"}
                </p>
              </div>
              <div className="text-left">
                <p className="font-black tabular-nums text-bad">{formatCurrency(e.amount)}</p>
                <button
                  type="button"
                  className="btn-icon mt-1 size-8 text-bad"
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
              حفظ
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <label>
            <span className="label">النوع</span>
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value as ExpenseKind)}>
              <option value="work">عمل</option>
              <option value="personal">شخصي</option>
            </select>
          </label>
          <label>
            <span className="label">التصنيف</span>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
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
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
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
    </div>
  );
}
