import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Layers,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { categoryLabel, unitLabel } from "@/lib/labels";
import { AppSelect } from "@/components/ui/AppSelect";
import {
  Alert,
  Chip,
  FilterChip,
  Meter,
  Money,
  PageHeader,
  SearchField,
  StatCard,
  StatGrid,
} from "@/components/ui/kit";
import { useStore } from "@/lib/store";
import type { InventoryCategory, InventoryItem, InventoryUnit } from "@/lib/types";
import { cn, formatMoney, nextNumber, todayIso } from "@/lib/utils";
import { ADVANCED_INVENTORY } from "@/lib/features";

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

/** الصفحة الكاملة للمخزن — تُحمَّل فقط عندما INVENTORY_ENABLED=true */
export function InventoryPageFull() {
  const rawInventory = useStore((s) => s.inventory);
  const customers = useStore((s) => s.customers);
  const addCustomer = useStore((s) => s.addCustomer);
  const inventory = Array.from(new Map(rawInventory.map((item) => [item.id, item])).values());
  const invoices = useStore((s) => s.invoices);
  const addInvoice = useStore((s) => s.addInvoice);
  const addInventoryItem = useStore((s) => s.addInventoryItem);
  const productCategories = useStore((s) => s.productCategories || []);
  const defaultWarehouseId = useStore((s) => s.defaultWarehouseId || "wh1");
  const warehouseId = defaultWarehouseId;
  const updateInventoryItem = useStore((s) => s.updateInventoryItem);
  const deleteInventoryItem = useStore((s) => s.deleteInventoryItem);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueItems, setIssueItems] = useState<
    Array<{ id: string; inventoryItemId: string; quantity: string }>
  >([]);
  const [receiptItems, setReceiptItems] = useState<
    Array<{ id: string; inventoryItemId: string; name: string; quantity: string }>
  >([]);

  const summary = useMemo(() => {
    const totalUnits = inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const lowCount = inventory.filter((item) => item.quantity <= (item.minQuantity || 0)).length;
    const stockValue = inventory.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0),
      0,
    );
    return { items: inventory.length, totalUnits, lowCount, stockValue };
  }, [inventory]);

  const categoryNames: Record<string, string> = { ...categoryLabel };
  for (const category of productCategories) {
    if (category.isActive) categoryNames[category.id] = category.name;
  }
  const categoryOptions = Object.entries(categoryNames);

  const filtered = useMemo(
    () =>
      inventory.filter((i) => {
        const matchQ = i.name.includes(q) || i.code.includes(q) || (i.color || "").includes(q);
        const matchC = cat === "all" || i.category === cat;
        return matchQ && matchC;
      }),
    [inventory, q, cat],
  );

  const maxQuantity = useMemo(
    () => Math.max(1, ...inventory.map((i) => Number(i.quantity) || 0)),
    [inventory],
  );

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, code: `ITM-${Math.floor(Math.random() * 9000 + 1000)}` });
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
    if (!form.name.trim()) {
      toast.error("أدخل اسم المادة");
      return;
    }
    const payload = {
      code: form.code,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: Number.parseFloat(form.quantity) || 0,
      costPrice: Number.parseFloat(form.costPrice) || 0,
      sellingPrice: Number.parseFloat(form.sellingPrice) || 0,
      minQuantity: Number.parseFloat(form.minQuantity) || 0,
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
    if (validItems.some((i) => !(Number.parseFloat(i.quantity) > 0)))
      return toast.error("تأكد من إدخال كميات صحيحة");
    for (const line of validItems) {
      const invItem = inventory.find((x) => x.id === line.inventoryItemId);
      if (invItem && Number.parseFloat(line.quantity) > invItem.quantity) {
        toast.error(`الكمية المطلوبة من «${invItem.name}» أكبر من المتوفر (${invItem.quantity})`);
        return;
      }
    }
    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.invoiceType === "ISSUE").map((i) => i.invoiceNumber),
      "ISS",
    );
    const internalParty = customers.find((c) => c.name === "الورشة (صرف داخلي)");
    let partyId = internalParty?.id;
    if (!partyId) {
      partyId = addCustomer({
        name: "الورشة (صرف داخلي)",
        phone: "-",
        address: "-",
        balance: 0,
        type: "retail",
      });
    }
    addInvoice({
      invoiceNumber,
      type: "sale",
      warehouseId,
      invoiceType: "ISSUE",
      partyId,
      date: todayIso(),
      items: validItems.map((i) => {
        const invItem = inventory.find((x) => x.id === i.inventoryItemId);
        return {
          id: Math.random().toString(36).slice(2),
          inventoryItemId: i.inventoryItemId,
          name: invItem?.name || "مادة",
          quantity: Number.parseFloat(i.quantity) || 1,
          unitPrice: 0,
          total: 0,
        };
      }),
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paymentType: "cash",
      status: "paid",
      isApproved: true,
    });
    toast.success("تم صرف المواد بنجاح");
    setIssueOpen(false);
  };

  const saveReceipt = () => {
    const validItems = receiptItems.filter((i) => i.inventoryItemId || i.name.trim());
    if (validItems.length === 0) return toast.error("أضف صنفاً واحداً على الأقل");
    if (validItems.some((i) => !(Number.parseFloat(i.quantity) > 0)))
      return toast.error("تأكد من إدخال كميات صحيحة");
    const invoiceNumber = nextNumber(
      invoices.filter((i) => i.type === "purchase").map((i) => i.invoiceNumber),
      "PUR",
    );
    const lines = validItems.map((i) => {
      const existing = i.inventoryItemId
        ? inventory.find((inv) => inv.id === i.inventoryItemId)
        : undefined;
      let productId = existing?.id;
      const typedName = i.name.trim();
      if (!productId && typedName) {
        productId = addInventoryItem({
          code: `MAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          name: typedName,
          category: "fabric" as InventoryCategory,
          unit: "piece" as InventoryUnit,
          quantity: 0,
          costPrice: 0,
          sellingPrice: 0,
          minQuantity: 0,
          color: "",
        });
      }
      return {
        id: Math.random().toString(36).slice(2),
        inventoryItemId: productId || undefined,
        name: existing?.name || typedName || "مادة",
        quantity: Number.parseFloat(i.quantity) || 1,
        unitPrice: 0,
        total: 0,
      };
    });
    addInvoice({
      invoiceNumber,
      warehouseId,
      type: "purchase",
      partyId: "PENDING_RECEIPT",
      date: todayIso(),
      items: lines,
      subTotal: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      status: "unpaid",
      isApproved: ADVANCED_INVENTORY ? false : true,
      paymentType: "deferred",
    });
    toast.success(
      ADVANCED_INVENTORY
        ? "تم إرسال أمر التوريد للمدير للمطابقة"
        : "تم إدخال البضاعة وتحديث الكميات المتبقية",
    );
    setReceiptOpen(false);
  };

  const categoryChips = ["all", ...categoryOptions.map(([k]) => k)];

  return (
    <div className="space-y-4">
      <PageHeader
        title={ADVANCED_INVENTORY ? "المخزن والأقمشة" : "المخزن"}
        subtitle={
          ADVANCED_INVENTORY
            ? "إدارة المواد الأولية ومستلزمات التطريز."
            : "إدخال بضاعة، إخراج بضاعة، ومعرفة الكميات المتبقية."
        }
        icon={Boxes}
        tone="navy"
        actions={
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setReceiptItems([
                  { id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" },
                ]);
                setReceiptOpen(true);
              }}
            >
              <ArrowDownToLine className="size-5" />
              {ADVANCED_INVENTORY ? "أمر توريد مخزني" : "إدخال بضاعة"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIssueItems([
                  { id: Math.random().toString(), inventoryItemId: "", quantity: "1" },
                ]);
                setIssueOpen(true);
              }}
            >
              <ArrowUpFromLine className="size-5" />
              {ADVANCED_INVENTORY ? "أمر صرف" : "إخراج بضاعة"}
            </button>
            <button type="button" className="btn-ghost" onClick={openNew}>
              <Plus className="size-5" />
              مادة جديدة
            </button>
          </>
        }
      />

      <StatGrid>
        <StatCard label="عدد الأصناف" value={summary.items} icon={Layers} tone="brand" hint="مادة مسجّلة" />
        <StatCard
          label="إجمالي الكميات"
          value={Number(summary.totalUnits.toFixed(2))}
          icon={Boxes}
          tone="navy"
          hint="مجموع المتبقي بكل الوحدات"
        />
        <StatCard
          label="تحت الحد الأدنى"
          value={summary.lowCount}
          icon={AlertTriangle}
          tone={summary.lowCount > 0 ? "bad" : "good"}
          hint={summary.lowCount > 0 ? "تحتاج تزويد عاجل" : "كل الكميات جيدة"}
        />
        <StatCard
          label="قيمة المخزون"
          value={formatMoney(summary.stockValue)}
          icon={Scissors}
          tone="gold"
          hint="بسعر التكلفة"
        />
      </StatGrid>

      {summary.lowCount > 0 ? (
        <Alert tone="warn" icon={AlertTriangle} title={`${summary.lowCount} صنف وصل للحد الأدنى`}>
          راجع الكميات وأدخل بضاعة قبل أن تتوقف الخدمة على نفاد المستلزمات.
        </Alert>
      ) : null}

      <div className="card space-y-3 p-3 sm:p-4">
        <SearchField value={q} onChange={setQ} placeholder="بحث بالاسم أو الرمز أو اللون…" />
        <div className="flex flex-wrap gap-2">
          {categoryChips.map((key) => (
            <FilterChip key={key} active={cat === key} onClick={() => setCat(key)}>
              {key === "all" ? "كل الفئات" : categoryNames[key] || key}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Scissors}
            title="لا توجد مواد مطابقة"
            hint={q || cat !== "all" ? "جرّب بحثًا أو فئة أخرى." : "أضف أول قطعة قماش أو خيط."}
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((item) => {
            const low = item.quantity <= (item.minQuantity || 0);
            const pct = ((Number(item.quantity) || 0) / maxQuantity) * 100;
            return (
              <article key={item.id} className="card card-hover overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="num font-mono text-[11px] font-bold text-muted">{item.code}</span>
                        <Chip tone="brand">{categoryNames[item.category] || item.category}</Chip>
                      </div>
                      <h3 className="mt-1 truncate text-base font-black text-ink">{item.name}</h3>
                      {item.color ? (
                        <p className="text-[11px] font-bold text-muted">اللون: {item.color}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left">
                      <p className={cn("num text-2xl font-black", low ? "text-bad" : "text-ink")}>
                        {item.quantity}
                      </p>
                      <p className="text-[11px] font-bold text-muted">{unitLabel[item.unit]}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Meter value={Number(item.quantity) || 0} max={maxQuantity} tone={low ? "bad" : "brand"} />
                    {low ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-black text-bad">
                        <AlertTriangle className="size-3.5" />
                        تحت الحد الأدنى ({item.minQuantity || 0})
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[11px] font-bold text-muted">
                        الحد الأدنى {item.minQuantity || 0} · النسبة من أعلى كمية {Math.round(pct)}%
                      </p>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="card-sunken px-3 py-2">
                      <p className="text-[10px] font-black text-muted">سعر التكلفة</p>
                      <Money value={formatMoney(item.costPrice)} className="text-sm text-ink" />
                    </div>
                    <div className="card-sunken px-3 py-2">
                      <p className="text-[10px] font-black text-muted">سعر البيع</p>
                      <Money value={formatMoney(item.sellingPrice)} tone="brand" className="text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-1 border-t border-line/70 bg-canvas/40 px-3 py-2">
                  <button type="button" className="btn-icon size-9" onClick={() => openEdit(item)} aria-label="تعديل">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon size-9 text-bad hover:bg-bad-soft hover:text-bad"
                    aria-label="حذف"
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

      <Modal open={open} title={editing ? "تعديل مادة" : "مادة جديدة"} onClose={() => setOpen(false)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
          <button type="button" className="btn-primary" onClick={save}><Plus className="size-4" />حفظ</button>
        </>}>
        <div className="grid gap-3">
          <label className="block"><span className="label">الرمز</span>
            <input className="input-field num" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="block"><span className="label">الاسم</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">الفئة</span>
              <AppSelect value={form.category} onChange={(v) => setForm({ ...form, category: v as InventoryCategory })}
                options={categoryOptions.map(([value, label]) => ({ value, label }))} searchable={false} /></label>
            <label className="block"><span className="label">الوحدة</span>
              <AppSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v as InventoryUnit })}
                options={Object.entries(unitLabel).map(([value, label]) => ({ value, label }))} searchable={false} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">الكمية</span>
              <input className="input-field num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label className="block"><span className="label">الحد الأدنى</span>
              <input className="input-field num" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">سعر التكلفة</span>
              <input className="input-field num" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></label>
            <label className="block"><span className="label">سعر البيع</span>
              <input className="input-field num" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></label>
          </div>
          <label className="block"><span className="label">اللون</span>
            <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
        </div>
      </Modal>

      <Modal open={receiptOpen} title={ADVANCED_INVENTORY ? "أمر توريد مخزني" : "إدخال بضاعة"} onClose={() => setReceiptOpen(false)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setReceiptOpen(false)}>إلغاء</button>
          <button type="button" className="btn-primary" onClick={saveReceipt}>حفظ</button>
        </>}>
        <div className="space-y-3">
          {receiptItems.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-[1fr_80px_auto] gap-2">
              <AppSelect value={line.inventoryItemId} onChange={(v) => {
                const next = [...receiptItems];
                next[idx] = { ...line, inventoryItemId: v, name: inventory.find((i) => i.id === v)?.name || line.name };
                setReceiptItems(next);
              }} searchable placeholder="اختر مادة أو اكتب اسمًا جديدًا"
                options={inventory.map((i) => ({ value: i.id, label: i.name, description: `متبقي: ${i.quantity}` }))} />
              <input className="input-field num" value={line.quantity} onChange={(e) => {
                const next = [...receiptItems]; next[idx] = { ...line, quantity: e.target.value }; setReceiptItems(next);
              }} />
              <button type="button" className="btn-icon" onClick={() => setReceiptItems(receiptItems.filter((x) => x.id !== line.id))}>
                <Trash2 className="size-4" /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setReceiptItems([...receiptItems, { id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" }])}>
            <Plus className="size-4" /> بند
          </button>
        </div>
      </Modal>

      <Modal open={issueOpen} title={ADVANCED_INVENTORY ? "أمر صرف" : "إخراج بضاعة"} onClose={() => setIssueOpen(false)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setIssueOpen(false)}>إلغاء</button>
          <button type="button" className="btn-primary" onClick={saveIssue}>حفظ</button>
        </>}>
        <div className="space-y-3">
          {issueItems.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-[1fr_80px_auto] gap-2">
              <AppSelect value={line.inventoryItemId} onChange={(v) => {
                const next = [...issueItems]; next[idx] = { ...line, inventoryItemId: v }; setIssueItems(next);
              }} searchable placeholder="اختر مادة"
                options={inventory.map((i) => ({ value: i.id, label: i.name, description: `متبقي: ${i.quantity}` }))} />
              <input className="input-field num" value={line.quantity} onChange={(e) => {
                const next = [...issueItems]; next[idx] = { ...line, quantity: e.target.value }; setIssueItems(next);
              }} />
              <button type="button" className="btn-icon" onClick={() => setIssueItems(issueItems.filter((x) => x.id !== line.id))}>
                <Trash2 className="size-4" /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setIssueItems([...issueItems, { id: Math.random().toString(), inventoryItemId: "", quantity: "1" }])}>
            <Plus className="size-4" /> بند
          </button>
        </div>
      </Modal>
    </div>
  );
}
