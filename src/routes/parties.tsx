import { createFileRoute } from "@tanstack/react-router";
import { FileText, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { CustomerStatementPreview } from "@/components/print/CustomerStatementPreview";
import { X } from "lucide-react";
import { customerTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Customer, CustomerType, Supplier } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/parties")({ component: PartiesPage });

function PartiesPage() {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const transactions = useStore((s) => s.transactions);
  const addCustomer = useStore((s) => s.addCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const deleteCustomer = useStore((s) => s.deleteCustomer);
  const addSupplier = useStore((s) => s.addSupplier);
  const updateSupplier = useStore((s) => s.updateSupplier);
  const deleteSupplier = useStore((s) => s.deleteSupplier);

  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    company: "",
    type: "retail" as CustomerType,
    balance: "0",
  });

  const list = tab === "customers" ? customers : suppliers;
  const filtered = useMemo(
    () =>
      list.filter(
        (p) => p.name.includes(q) || p.phone.includes(q) || ("company" in p && p.company.includes(q)),
      ),
    [list, q],
  );

  const debt =
    tab === "customers"
      ? customers.reduce((s, c) => s + Math.max(0, c.balance), 0)
      : suppliers.reduce((s, c) => s + Math.max(0, c.balance), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", phone: "", address: "", company: "", type: "retail", balance: "0" });
    setOpen(true);
  };

  const openEdit = (p: Customer | Supplier) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      phone: p.phone,
      address: "address" in p ? p.address : "",
      company: "company" in p ? p.company : "",
      type: "type" in p ? p.type : "retail",
      balance: String(p.balance),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("أدخل الاسم");
    const balance = parseFloat(form.balance) || 0;
    if (tab === "customers") {
      const data = {
        name: form.name.trim(),
        phone: form.phone,
        address: form.address,
        type: form.type,
        balance,
      };
      if (editing) updateCustomer(editing, data);
      else addCustomer(data);
    } else {
      const data = {
        name: form.name.trim(),
        phone: form.phone,
        company: form.company,
        balance,
      };
      if (editing) updateSupplier(editing, data);
      else addSupplier(data);
    }
    toast.success("تم الحفظ");
    setOpen(false);
  };

  const statementParty =
    customers.find((c) => c.id === statementId) || suppliers.find((s) => s.id === statementId);
  const statementRows = useMemo(() => {
    if (!statementId) return [];
    return transactions
      .filter((t) => t.partyId === statementId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [statementId, transactions]);

  const statementOpeningBalance = useMemo(() => {
    if (!statementId || !statementParty) return 0;
    const partyTxns = statementRows;
    if (partyTxns.length === 0) return statementParty.balance;
    const isCustomer = "address" in statementParty;
    const netChange = partyTxns.reduce((sum, t) => {
      if (isCustomer) {
        return sum + (t.debit || 0) - (t.credit || 0);
      }
      return sum + (t.credit || 0) - (t.debit || 0);
    }, 0);
    return statementParty.balance - netChange;
  }, [statementId, statementParty, statementRows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">{tab === "customers" ? "العملاء" : "الموردون"}</h1>
          <p className="page-subtitle">الأرصدة، الهواتف، وكشوف الحساب.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openNew}>
          <Plus className="size-5" />
          {tab === "customers" ? "عميل جديد" : "مورد جديد"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold text-muted">العدد</p>
          <p className="text-2xl font-black tabular-nums">{list.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold text-muted">
            {tab === "customers" ? "إجمالي المديونية" : "ما ندين به"}
          </p>
          <p className="text-2xl font-black tabular-nums text-accent">{formatCurrency(debt)}</p>
        </div>
      </div>

      <div className="flex rounded-2xl bg-paper p-1 shadow-sm">
        {(["customers", "suppliers"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${tab === t ? "bg-brand text-brand-fg" : "text-muted"}`}
          >
            {t === "customers" ? "العملاء" : "الموردون"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          className="input-field pr-10"
          placeholder="بحث بالاسم أو الهاتف…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title="لا توجد سجلات" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <article key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-black text-brand">
                  {p.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black">{p.name}</h3>
                      {"type" in p ? (
                        <span className="text-xs font-bold text-muted">
                          {customerTypeLabel[p.type]}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-muted">{p.company}</span>
                      )}
                    </div>
                    <p
                      className={`text-left text-lg font-black tabular-nums ${p.balance > 0 ? "text-accent" : p.balance < 0 ? "text-good" : "text-muted"}`}
                    >
                      {formatCurrency(p.balance)}
                    </p>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted" dir="ltr">
                    <Phone className="size-3.5" />
                    {p.phone || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-1 border-t border-line pt-3">
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  onClick={() => setStatementId(p.id)}
                >
                  <FileText className="size-4" />
                  كشف حساب
                </button>
                <button type="button" className="btn-icon size-9" onClick={() => openEdit(p)}>
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="btn-icon size-9 text-bad"
                  onClick={() => {
                    if (!confirm("حذف هذا السجل؟")) return;
                    if (tab === "customers") deleteCustomer(p.id);
                    else deleteSupplier(p.id);
                    toast.success("تم الحذف");
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
        title={editing ? "تعديل" : tab === "customers" ? "عميل جديد" : "مورد جديد"}
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
            <span className="label">الاسم</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            <span className="label">الهاتف</span>
            <input className="input-field" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          {tab === "customers" ? (
            <>
              <label>
                <span className="label">العنوان</span>
                <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>
              <label>
                <span className="label">النوع</span>
                <select
                  className="input-field"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}
                >
                  <option value="retail">مفرد</option>
                  <option value="wholesale">جملة</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              <span className="label">الشركة</span>
              <input className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </label>
          )}
          <label>
            <span className="label">رصيد افتتاحي</span>
            <input className="input-field" inputMode="decimal" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          </label>
        </div>
      </Modal>

      {statementParty ? (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-auto bg-canvas">
          <div className="sticky top-0 z-10 flex justify-end border-b border-line bg-paper/80 p-4 backdrop-blur-sm no-print">
            <button className="btn-ghost" onClick={() => setStatementId(null)}>
              <X className="size-5" /> إغلاق
            </button>
          </div>
          <CustomerStatementPreview
            statement={{
              statementNumber: Date.now().toString().slice(-6),
              date: new Date().toLocaleDateString("en-GB"),
              customerName: statementParty.name,
              customerNumber: statementParty.id.slice(0, 8),
              phone: "phone" in statementParty ? statementParty.phone : "",
              address: "address" in statementParty ? statementParty.address : "",
              periodFrom: statementRows.length
                ? new Date(statementRows[0].date).toLocaleDateString("en-GB")
                : "",
              periodTo: statementRows.length
                ? new Date(statementRows[statementRows.length - 1].date).toLocaleDateString("en-GB")
                : "",
              entries: statementRows.map((r) => ({
                id: r.id,
                date: new Date(r.date).toLocaleDateString("en-GB"),
                transactionType: r.documentType === "invoice"
                  ? r.documentNumber?.startsWith("PUR")
                    ? "فاتورة مشتريات"
                    : "فاتورة مبيعات"
                  : r.documentType === "voucher"
                    ? r.documentNumber?.startsWith("PAY")
                      ? "سند صرف"
                      : r.documentNumber?.startsWith("REC")
                        ? "سند قبض"
                        : "سند"
                    : r.documentType === "expense"
                      ? "مصروف"
                      : r.description,
                documentNumber: r.documentNumber,
                description: r.description,
                debit: r.debit || undefined,
                credit: r.credit || undefined,
                documentType: r.documentType,
              })),
              openingBalance: statementOpeningBalance,
            }}
            company={{
              name: useStore.getState().settings.name,
              location: useStore.getState().settings.location,
              phone1: useStore.getState().settings.phone1,
              phone2: useStore.getState().settings.phone2,
              logoSrc: "/logo.svg",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
