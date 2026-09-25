import { createLazyFileRoute } from "@tanstack/react-router";
import {
  ArrowDownUp,
  Building2,
  FileText,
  Pencil,
  Phone,
  Plus,
  Store,
  Trash2,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { AppSelect } from "@/components/ui/AppSelect";
import { CustomerStatementPreview } from "@/components/print/CustomerStatementPreview";
import {
  Avatar,
  Chip,
  Money,
  PageHeader,
  SearchField,
  Segmented,
  StatCard,
  StatGrid,
  toneTile,
} from "@/components/ui/kit";
import { customerTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Customer, CustomerType, Supplier } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

export const Route = createLazyFileRoute("/parties")({ component: PartiesPage });

type SortKey = "name" | "balance" | "debt";

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
  const [sort, setSort] = useState<SortKey>("balance");
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

  const filtered = useMemo(() => {
    const rows = list.filter(
      (p) =>
        !q ||
        p.name.includes(q) ||
        p.phone.includes(q) ||
        ("company" in p && p.company.includes(q)),
    );
    const sorted = [...rows];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    else if (sort === "debt")
      sorted.sort((a, b) => Math.max(0, b.balance) - Math.max(0, a.balance));
    else sorted.sort((a, b) => b.balance - a.balance);
    return sorted;
  }, [list, q, sort]);

  const totalDebt = list.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const totalCredit = list.reduce((s, c) => s + Math.min(0, c.balance), 0);
  const debtors = list.filter((c) => c.balance > 0);

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
    if (!form.name.trim()) {
      toast.error("أدخل الاسم");
      return;
    }
    const balance = Number.parseFloat(form.balance) || 0;
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

  const isCustomer = tab === "customers";

  return (
    <div className="space-y-4">
      <PageHeader
        title={isCustomer ? "العملاء" : "الموردون"}
        subtitle="الأرصدة، الهواتف، وكشوف الحساب."
        icon={isCustomer ? Users : Store}
        tone={isCustomer ? "brand" : "navy"}
        actions={
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus className="size-5" />
            {isCustomer ? "عميل جديد" : "مورد جديد"}
          </button>
        }
      />

      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQ("");
        }}
        options={[
          { value: "customers" as const, label: "العملاء", icon: Users, count: customers.length },
          { value: "suppliers" as const, label: "الموردون", icon: Store, count: suppliers.length },
        ]}
        className="sm:max-w-md"
      />

      <StatGrid cols={3}>
        <StatCard
          label={isCustomer ? "إجمالي المديونية" : "ما ندين به"}
          value={formatMoney(totalDebt)}
          icon={TrendingDown}
          tone="accent"
          hint={`على ${debtors.length} جهة`}
        />
        <StatCard
          label={isCustomer ? "أرصدة دائنة (لهم)" : "أرصدة لنا"}
          value={formatMoney(Math.abs(totalCredit))}
          icon={Wallet}
          tone="good"
          hint="دفعات مقدمة أو زيادات"
        />
        <StatCard
          label="عدد السجلات"
          value={list.length}
          icon={ArrowDownUp}
          tone="navy"
          hint={`المعروض ${filtered.length}`}
        />
      </StatGrid>

      <div className="card grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:p-4">
        <SearchField value={q} onChange={setQ} placeholder="ابحث بالاسم أو الهاتف…" />
        <AppSelect
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          searchable={false}
          options={[
            { value: "balance", label: "ترتيب: الرصيد (تنازلي)" },
            { value: "debt", label: "ترتيب: المديونية" },
            { value: "name", label: "ترتيب: الاسم (أبجدي)" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="لا توجد سجلات مطابقة"
            hint={q ? "جرّب كلمة بحث أخرى." : "أضف أول جهة من الزر أعلاه."}
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((p) => {
            const positive = p.balance > 0;
            const zero = p.balance === 0;
            return (
              <article key={p.id} className="card card-hover overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <Avatar
                    name={p.name}
                    tone={zero ? "muted" : positive ? "accent" : "good"}
                    className="size-12 rounded-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-ink">{p.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {"type" in p ? (
                            <Chip tone="muted" icon={Users}>
                              {customerTypeLabel[p.type]}
                            </Chip>
                          ) : (
                            <Chip tone="muted" icon={Building2}>
                              {p.company || "مورد"}
                            </Chip>
                          )}
                          <span
                            className="flex items-center gap-1 text-[11px] font-bold text-muted"
                            dir="ltr"
                          >
                            <Phone className="size-3" />
                            {p.phone || "—"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <Money
                          value={formatMoney(p.balance)}
                          tone={zero ? "muted" : positive ? "accent" : "good"}
                          className="text-base"
                        />
                        <p className="text-[11px] font-bold text-muted">
                          {zero ? "مسدَّد" : positive ? "مدين" : "دائن"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-1 border-t border-line/70 bg-canvas/40 px-3 py-2">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setStatementId(p.id)}
                  >
                    <FileText className="size-4" />
                    كشف حساب
                  </button>
                  <button
                    type="button"
                    className="btn-icon size-9"
                    onClick={() => openEdit(p)}
                    aria-label="تعديل"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon size-9 text-bad hover:bg-bad-soft hover:text-bad"
                    aria-label="حذف"
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
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? "تعديل بيانات الجهة" : isCustomer ? "عميل جديد" : "مورد جديد"}
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
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
            <span className={cn("tile-icon", toneTile(isCustomer ? "brand" : "navy"))}>
              {isCustomer ? <Users className="size-5" /> : <Store className="size-5" />}
            </span>
            <div>
              <p className="text-sm font-black text-ink">
                {isCustomer ? "بيانات العميل" : "بيانات المورد"}
              </p>
              <p className="text-[11px] font-bold text-muted">
                الرصيد الافتتاحي يُضاف إلى الذمة مباشرة.
              </p>
            </div>
          </div>

          <label>
            <span className="label">الاسم</span>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="الاسم الكامل"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">الهاتف</span>
              <input
                className="input-field num"
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="7xxxxxxxx"
              />
            </label>
            {isCustomer ? (
              <div>
                <span className="label">النوع</span>
                <AppSelect
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v as CustomerType })}
                  searchable={false}
                  options={[
                    { value: "retail", label: "مفرد" },
                    { value: "wholesale", label: "جملة" },
                  ]}
                />
              </div>
            ) : (
              <label>
                <span className="label">الشركة</span>
                <input
                  className="input-field"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </label>
            )}
          </div>

          {isCustomer ? (
            <label>
              <span className="label">العنوان</span>
              <input
                className="input-field"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="المدينة / الحي"
              />
            </label>
          ) : null}

          <label>
            <span className="label">الرصيد الافتتاحي</span>
            <input
              className="input-field num"
              inputMode="decimal"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              placeholder="0"
            />
            <span className="field-hint">موجب = مدين لنا، سالب = دائن له.</span>
          </label>
        </div>
      </Modal>

      {statementParty ? (
        <CustomerStatementPreview
          onClose={() => setStatementId(null)}
          statement={{
            statementNumber: Date.now().toString().slice(-6),
            date: new Date().toLocaleDateString("en-GB"),
            customerName: statementParty.name,
            customerNumber: statementParty.id.slice(0, 8),
            accountType: isCustomer ? "عميل" : "مورد",
            phone: "phone" in statementParty ? statementParty.phone : "",
            address: "address" in statementParty ? statementParty.address : "",
            periodFrom: statementRows.length
              ? new Date(statementRows[statementRows.length - 1].date).toLocaleDateString("en-GB")
              : "",
            periodTo: statementRows.length
              ? new Date(statementRows[0].date).toLocaleDateString("en-GB")
              : "",
            entries: statementRows.map((r) => ({
              id: r.id,
              date: new Date(r.date).toLocaleDateString("en-GB"),
              transactionType: r.description,
              documentNumber: r.documentNumber,
              description: r.description,
              debit: r.debit || undefined,
              credit: r.credit || undefined,
              documentType: r.documentNumber?.startsWith("INV") ? "فاتورة" : "سند",
            })),
            openingBalance: 0,
          }}
          company={{
            name: useStore.getState().organization.name,
            location: useStore.getState().organization.address || "",
            phone1: useStore.getState().organization.phone || "",
            phone2: useStore.getState().organization.commercialNumber || "",
            logoSrc: useStore.getState().organization.logo,
          }}
        />
      ) : null}
    </div>
  );
}
