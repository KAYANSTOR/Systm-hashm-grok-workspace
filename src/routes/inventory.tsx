import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Pencil, Plus, Scissors, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { categoryLabel, unitLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

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
  const inventory = useStore((s) => s.inventory);
  const addInventoryItem = useStore((s) => s.addInventoryItem);
  const updateInventoryItem = useStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useStore((s) => s.deleteInventoryItem);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | InventoryCategory>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">المخزن والأقمشة</h1>
          <p className="page-subtitle">إدارة المواد الأولية ومستلزمات التطريز.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openNew}>
          <Plus className="size-5" />
          إضافة مادة
        </button>
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
