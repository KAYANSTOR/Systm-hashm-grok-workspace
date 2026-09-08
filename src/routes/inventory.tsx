import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2, ArrowDownRight, ArrowUpRight, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { categoryLabel, unitLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/types";
import { formatCurrency, nextNumber, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

const emptyForm = {
  code: "",
  name: "",
  category: "fabric" as InventoryCategory,
  unit: "roll" as InventoryUnit,
  quantity: "1",
  costPrice: "0",
  sellingPrice: "0",
  minQuantity: "0",
  color: "",
};

function InventoryPage() {
  const rawInventory = useStore((s) => s.inventory);
  const customers = useStore((s) => s.customers);
  const addCustomer = useStore((s) => s.addCustomer);
  const inventory = Array.from(new Map(rawInventory.map(item => [item.id, item])).values());
  const invoices = useStore((s) => s.invoices);
  const addInvoice = useStore((s) => s.addInvoice);
  const addInventoryItem = useStore((s) => s.addInventoryItem);
  const updateInventoryItem = useStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useStore((s) => s.deleteInventoryItem);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | InventoryCategory>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueItems, setIssueItems] = useState<Array<{ id: string; inventoryItemId: string; quantity: string }>>([]);
  const [receiptItems, setReceiptItems] = useState<Array<{ id: string; inventoryItemId: string; name: string; quantity: string }>>([]);

  const filtered = useMemo(
    () =>
      inventory.filter((i) => {
        const matchQ = i.name.includes(q) || i.code.includes(q) || (i.color || "").includes(q);
        const matchC = cat === "all" || i.category === cat;
        return matchQ && matchC;
      }),
    [inventory, q, cat],
  );

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      code: `ITM-${Math.floor(Math.random() * 9000 + 1000)}`,
    });
    setOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item.id);
    setForm({
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: String(item.quantity),
      costPrice: String(item.costPrice),
      sellingPrice: String(item.sellingPrice),
      minQuantity: String(item.minQuantity || 0),
      color: item.color || "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("أدخل اسم المادة");
    const payload = {
      code: form.code,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 0,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      minQuantity: parseFloat(form.minQuantity) || 0,
      color: form.color,
    };
    if (editing) {
      updateInventoryItem(editing, payload);
      toast.success("تم تحديث المادة");
    } else {
      addInventoryItem(payload);
      toast.success("تمت إضافة المادة");
    }
    setOpen(false);
  };


  
  const saveIssue = () => {
    const validItems = issueItems.filter((i) => i.inventoryItemId);
    if (validItems.length === 0) return toast.error("أضف مادة واحدة على الأقل");
    if (validItems.some((i) => !parseFloat(i.quantity))) return toast.error("تأكد من إدخال كميات صحيحة");

    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.invoiceType === "ISSUE").map((i) => i.invoiceNumber),
      "ISS"
    );

    // Make sure we have an INTERNAL_ISSUE customer or just use a fallback
    const internalParty = customers.find(c => c.name === "الورشة (صرف داخلي)");
    let partyId = internalParty?.id;
    if (!partyId) {
      partyId = addCustomer({ name: "الورشة (صرف داخلي)", phone: "-", address: "-", balance: 0, type: "retail" });
    }

    addInvoice({
      invoiceNumber,
      type: "sale",
      invoiceType: "ISSUE",
      partyId: partyId,
      date: todayIso(),
      items: validItems.map((i) => {
        const invItem = inventory.find(x => x.id === i.inventoryItemId);
        return {
          id: Math.random().toString(36).slice(2),
          inventoryItemId: i.inventoryItemId,
          name: invItem?.name || "مادة",
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: 0,
          total: 0
        };
      }),
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentType: "cash",
      status: "paid",
      isApproved: true, // Auto-approve issues
    });

    toast.success("تم صرف المواد بنجاح");
    setIssueOpen(false);
  };


  const saveReceipt = () => {
    const validItems = receiptItems.filter((i) => i.inventoryItemId || i.name.trim());
    if (validItems.length === 0) return toast.error("أضف مادة واحدة على الأقل");
    if (validItems.some((i) => !parseFloat(i.quantity))) return toast.error("تأكد من إدخال كميات صحيحة");

    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.type === "purchase").map((i) => i.invoiceNumber),
      "PUR"
    );

    addInvoice({
      invoiceNumber,
      type: "purchase",
      partyId: "PENDING_RECEIPT",
      date: todayIso(),
      items: validItems.map((i) => ({
        id: Math.random().toString(36).slice(2),
        inventoryItemId: i.inventoryItemId || undefined,
        name: i.inventoryItemId ? (inventory.find((inv) => inv.id === i.inventoryItemId)?.name || i.name) : i.name,
        quantity: parseFloat(i.quantity) || 1,
        unitPrice: 0,
        total: 0,
      })),
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      status: "unpaid",
      isApproved: false,
      paymentType: "deferred",
    });
    toast.success("تم إرسال أمر التوريد للمدير للمطابقة");
    setReceiptOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">المخزن والأقمشة</h1>
          <p className="page-subtitle">إدارة المواد الأولية ومستلزمات التطريز.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setReceiptItems([{ id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" }]); setReceiptOpen(true); }}>
            <Plus className="size-5" />
            أمر توريد مخزني
          </button>
          
          <button type="button" className="btn-ghost text-bad" onClick={() => {
            setIssueItems([{ id: Math.random().toString(), inventoryItemId: "", quantity: "1" }]);
            setIssueOpen(true);
          }}>
            <Plus className="size-4" /> أمر صرف
          </button>
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus className="size-5" />
            إضافة مادة
          </button>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            className="input-field pr-10"
            placeholder="بحث بالاسم أو الرمز أو اللون…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:w-44"
          value={cat}
          onChange={(e) => setCat(e.target.value as typeof cat)}
        >
          <option value="all">كل الفئات</option>
          {Object.entries(categoryLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Scissors} title="لا توجد مواد" hint="أضف أول قطعة قماش أو خيط." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => {
            const low = item.quantity <= (item.minQuantity || 0);
            return (
              <article key={item.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted">{item.code}</p>
                    <h3 className="text-lg font-black">{item.name}</h3>
                    <p className="text-xs text-muted">اللون: {item.color || "غير محدد"}</p>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
                    {categoryLabel[item.category]}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className={`text-2xl font-black tabular-nums ${low ? "text-bad" : "text-ink"}`}>
                      {item.quantity}
                      <span className="mr-1 text-xs font-bold text-muted">
                        {unitLabel[item.unit]}
                      </span>
                    </p>
                    {low ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-bad">
                        <AlertTriangle className="size-3.5" />
                        أقل من الحد الأدنى ({item.minQuantity})
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left text-xs text-muted">
                    <p>تكلفة {formatCurrency(item.costPrice)}</p>
                    <p className="font-bold text-brand">بيع {formatCurrency(item.sellingPrice)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-line pt-3">
                  <button type="button" className="btn-icon size-9" onClick={() => openEdit(item)}>
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon size-9 text-bad"
                    onClick={() => {
                      if (confirm("حذف هذه المادة؟")) {
                        deleteInventoryItem(item.id);
                        toast.success("تم الحذف");
                      }
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
        title={editing ? "تعديل مادة" : "مادة جديدة"}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الرمز">
            <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="الاسم">
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="الفئة">
            <select
              className="input-field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
            >
              {Object.entries(categoryLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الوحدة">
            <select
              className="input-field"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as InventoryUnit })}
            >
              {Object.entries(unitLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الكمية">
            <input className="input-field" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="الحد الأدنى">
            <input className="input-field" inputMode="decimal" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
          </Field>
          <Field label="سعر التكلفة">
            <input className="input-field" inputMode="decimal" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          </Field>
          <Field label="سعر البيع">
            <input className="input-field" inputMode="decimal" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </Field>
          <Field label="اللون">
            <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="أمر توريد مخزني">
        <div className="space-y-4">
          <p className="text-sm text-muted">سيتم إرسال هذا الأمر للإدارة لمطابقته مع فاتورة المشتريات وإضافة الأسعار.</p>
          <div className="space-y-3">
            {receiptItems.map((item, index) => (
              <div key={item.id} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <select
                    className="input-field"
                    value={item.inventoryItemId}
                    onChange={(e) => {
                      const newItems = [...receiptItems];
                      newItems[index].inventoryItemId = e.target.value;
                      setReceiptItems(newItems);
                    }}
                  >
                    <option value="">-- اختر من المخزن (أو اكتب اسم جديد) --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({inv.code})</option>
                    ))}
                  </select>
                  {!item.inventoryItemId && (
                    <input
                      className="input-field"
                      placeholder="اسم الصنف (إذا لم يكن في المخزن)"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...receiptItems];
                        newItems[index].name = e.target.value;
                        setReceiptItems(newItems);
                      }}
                    />
                  )}
                </div>
                <input
                  type="number"
                  className="input-field w-24"
                  placeholder="الكمية"
                  value={item.quantity}
                  min="1"
                  onChange={(e) => {
                    const newItems = [...receiptItems];
                    newItems[index].quantity = e.target.value;
                    setReceiptItems(newItems);
                  }}
                />
                <button
                  type="button"
                  className="btn-icon text-bad"
                  onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => setReceiptItems([...receiptItems, { id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" }])}
          >
            <Plus className="size-4" />
            إضافة صنف آخر
          </button>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-primary flex-1" onClick={saveReceipt}>
              إرسال للمطابقة
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={() => setReceiptOpen(false)}>
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="أمر صرف مخزني">
        <div className="space-y-4">
          <p className="text-sm text-muted">سجّل المواد المصروفة للورشة، وسيتم خصمها من رصيد المخزن.</p>
          <div className="space-y-3">
            {issueItems.map((item, index) => (
              <div key={item.id} className="flex items-start gap-2">
                <select
                  className="input-field flex-1"
                  value={item.inventoryItemId}
                  onChange={(e) => {
                    const next = [...issueItems];
                    next[index] = { ...next[index], inventoryItemId: e.target.value };
                    setIssueItems(next);
                  }}
                >
                  <option value="">اختر مادة من المخزن</option>
                  {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name} ({inv.quantity} {unitLabel[inv.unit]})</option>)}
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input-field w-24"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...issueItems];
                    next[index] = { ...next[index], quantity: e.target.value };
                    setIssueItems(next);
                  }}
                />
                <button type="button" className="btn-icon text-bad" aria-label="حذف البند" onClick={() => setIssueItems(issueItems.filter((_, i) => i !== index))}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost w-full" onClick={() => setIssueItems([...issueItems, { id: Math.random().toString(), inventoryItemId: "", quantity: "1" }])}>
            <Plus className="size-4" /> إضافة مادة أخرى
          </button>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-primary flex-1" onClick={saveIssue}>حفظ أمر الصرف</button>
            <button type="button" className="btn-ghost flex-1" onClick={() => setIssueOpen(false)}>إلغاء</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
