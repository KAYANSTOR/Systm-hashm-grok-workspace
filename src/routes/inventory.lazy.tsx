import { createLazyFileRoute } from "@tanstack/react-router";
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

export const Route = createLazyFileRoute("/inventory")({ component: InventoryPage });

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
  const inventory = Array.from(new Map(rawInventory.map((item) => [item.id, item])).values());
  const invoices = useStore((s) => s.invoices);
  const addInvoice = useStore((s) => s.addInvoice);
  const addInventoryItem = useStore((s) => s.addInventoryItem);
  const productCategories = useStore((s) => s.productCategories || []);
  const defaultWarehouseId = useStore((s) => s.defaultWarehouseId || "wh1");
  // المخزن الافتراضي ثابت في الوضع المبسّط (إدخال/إخراج) فلا حاجة لمبدّل مخازن.
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

  // ملخص سريع: كم صنفًا، إجمالي الكميات، وكم صنفًا وصل للحد الأدنى.
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
    if (validItems.length === 0) {
      toast.error("أضف مادة واحدة على الأقل");
      return;
    }
    if (validItems.some((i) => !(Number.parseFloat(i.quantity) > 0))) {
      toast.error("تأكد من إدخال كميات صحيحة");
      return;
    }
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

    // جهة داخلية ثابتة تمثل الورشة حتى لا تظهر أرصدة صرف داخلي على العملاء.
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
      partyId: partyId,
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
      isApproved: true, // صرف داخلي معتمد تلقائيًا
    });

    toast.success("تم صرف المواد بنجاح");
    setIssueOpen(false);
  };

  /**
   * إدخال بضاعة: في الوضع المبسّط يُضاف المخزون **فورًا** (بلا انتظار مطابقة)،
   * وفي الوضع المتقدم يبقى السلوك القديم (أمر توريد للمطابقة).
   * الصنف المكتوب بالاسم ولم يكن في المخزن يُنشأ أولًا حتى تُسجَّل الكمية على
   * مادة حقيقية — وإلا فُقدت الكمية لأن حركة المخزون تحتاج معرّف مادة.
   */
  const saveReceipt = () => {
    const validItems = receiptItems.filter((i) => i.inventoryItemId || i.name.trim());
    if (validItems.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }
    if (validItems.some((i) => !(Number.parseFloat(i.quantity) > 0))) {
      toast.error("تأكد من إدخال كميات صحيحة");
      return;
    }

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
      // في الوضع المبسّط: إدخال فعلي ومباشر — لا خطوة مطابقة.
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
        <StatCard
          label="عدد الأصناف"
          value={summary.items}
          icon={Layers}
          tone="brand"
          hint="مادة مسجّلة"
        />
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
                        <span className="num font-mono text-[11px] font-bold text-muted">
                          {item.code}
                        </span>
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
                    <Meter
                      value={Number(item.quantity) || 0}
                      max={maxQuantity}
                      tone={low ? "bad" : "brand"}
                    />
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
                      <Money
                        value={formatMoney(item.sellingPrice)}
                        tone="brand"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-1 border-t border-line/70 bg-canvas/40 px-3 py-2">
                  <button
                    type="button"
                    className="btn-icon size-9"
                    onClick={() => openEdit(item)}
                    aria-label="تعديل"
                  >
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

      {/* ————— مادة جديدة/تعديل ————— */}
      <Modal
        open={open}
        title={editing ? "تعديل مادة" : "مادة جديدة"}
        onClose={() => setOpen(false)}
        wide
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الرمز">
            <input
              className="input-field num"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="الاسم">
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="الفئة">
            <AppSelect
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as InventoryCategory })}
              options={categoryOptions.map(([value, label]) => ({ value, label }))}
              searchable={false}
            />
          </Field>
          <Field label="الوحدة">
            <AppSelect
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v as InventoryUnit })}
              options={Object.entries(unitLabel).map(([value, label]) => ({ value, label }))}
              searchable={false}
            />
          </Field>
          {!editing || ADVANCED_INVENTORY ? (
            <Field label={editing ? "الكمية" : "الكمية الافتتاحية (اختياري)"}>
              <input
                className="input-field num"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
          ) : (
            <div className="card-sunken flex items-start gap-2 px-3 py-2.5 text-[11px] font-bold text-muted sm:col-span-1">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              الكمية المتبقية تتغير من «إدخال بضاعة» و«إخراج بضاعة» فقط — لا تُعدَّل من هنا حتى لا
              يختلف المخزون عن الحركات المسجّلة.
            </div>
          )}
          <Field label="الحد الأدنى">
            <input
              className="input-field num"
              inputMode="decimal"
              value={form.minQuantity}
              onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
            />
          </Field>
          <Field label="سعر التكلفة">
            <input
              className="input-field num"
              inputMode="decimal"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            />
          </Field>
          <Field label="سعر البيع">
            <input
              className="input-field num"
              inputMode="decimal"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            />
          </Field>
          <Field label="اللون">
            <input
              className="input-field"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* ————— إدخال بضاعة ————— */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        wide
        title={ADVANCED_INVENTORY ? "أمر توريد مخزني" : "إدخال بضاعة"}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setReceiptOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-primary" onClick={saveReceipt}>
              {ADVANCED_INVENTORY ? "إرسال للمطابقة" : "إدخال البضاعة"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="brand" icon={ArrowDownToLine} title="إدخال كميات إلى المخزن">
            {ADVANCED_INVENTORY
              ? "سيتم إرسال هذا الأمر للإدارة لمطابقته مع فاتورة المشتريات وإضافة الأسعار."
              : "تُضاف الكميات إلى المخزن مباشرة ويظهر المتبقي في القائمة. الاسم الجديد يُنشئ مادة جديدة تلقائيًا."}
          </Alert>

          <div className="space-y-2">
            {receiptItems.map((item, index) => (
              <div key={item.id} className="card-sunken flex items-start gap-2 p-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <AppSelect
                    value={item.inventoryItemId}
                    onChange={(v) => {
                      const newItems = [...receiptItems];
                      newItems[index].inventoryItemId = v;
                      setReceiptItems(newItems);
                    }}
                    placeholder="اختر صنفًا من المخزن…"
                    clearable
                    options={inventory.map((inv) => ({
                      value: inv.id,
                      label: inv.name,
                      description: `${inv.code} · المتبقي ${inv.quantity} ${unitLabel[inv.unit]}`,
                    }))}
                  />
                  {!item.inventoryItemId ? (
                    <input
                      className="input-field"
                      placeholder="أو اكتب اسم صنف جديد ليُنشأ تلقائيًا"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...receiptItems];
                        newItems[index].name = e.target.value;
                        setReceiptItems(newItems);
                      }}
                    />
                  ) : null}
                </div>
                <input
                  type="number"
                  className="input-field num w-24 shrink-0"
                  placeholder="الكمية"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...receiptItems];
                    newItems[index].quantity = e.target.value;
                    setReceiptItems(newItems);
                  }}
                />
                <button
                  type="button"
                  className="btn-icon shrink-0 text-bad hover:bg-bad-soft hover:text-bad"
                  aria-label="حذف البند"
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
            onClick={() =>
              setReceiptItems([
                ...receiptItems,
                { id: Math.random().toString(), inventoryItemId: "", name: "", quantity: "1" },
              ])
            }
          >
            <Plus className="size-4" />
            إضافة صنف آخر
          </button>
        </div>
      </Modal>

      {/* ————— إخراج بضاعة ————— */}
      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        wide
        title={ADVANCED_INVENTORY ? "أمر صرف مخزني" : "إخراج بضاعة"}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setIssueOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-secondary" onClick={saveIssue}>
              {ADVANCED_INVENTORY ? "حفظ أمر الصرف" : "إخراج البضاعة"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="warn" icon={ArrowUpFromLine} title="صرف من المخزن إلى الورشة">
            سجّل ما خرج من المخزن، ويُخصم من المتبقي فورًا. لا يمكن إخراج كمية أكبر من المتوفر.
          </Alert>

          <div className="space-y-2">
            {issueItems.map((item, index) => {
              const selected = inventory.find((x) => x.id === item.inventoryItemId);
              const requested = Number.parseFloat(item.quantity) || 0;
              const over = Boolean(selected) && requested > (selected?.quantity || 0);
              return (
                <div key={item.id} className="card-sunken p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <AppSelect
                        value={item.inventoryItemId}
                        onChange={(v) => {
                          const next = [...issueItems];
                          next[index] = { ...next[index], inventoryItemId: v };
                          setIssueItems(next);
                        }}
                        placeholder="اختر مادة من المخزن…"
                        options={inventory.map((inv) => ({
                          value: inv.id,
                          label: inv.name,
                          description: `المتبقي ${inv.quantity} ${unitLabel[inv.unit]}`,
                        }))}
                      />
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="input-field num w-24 shrink-0"
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...issueItems];
                        next[index] = { ...next[index], quantity: e.target.value };
                        setIssueItems(next);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-icon shrink-0 text-bad hover:bg-bad-soft hover:text-bad"
                      aria-label="حذف البند"
                      onClick={() => setIssueItems(issueItems.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {selected ? (
                    <p
                      className={cn(
                        "mt-1.5 text-[11px] font-black",
                        over ? "text-bad" : "text-muted",
                      )}
                    >
                      {over
                        ? `المطلوب أكبر من المتوفر (${selected.quantity})`
                        : `المتوفر ${selected.quantity} → بعد الصرف ${Number((selected.quantity - requested).toFixed(2))}`}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() =>
              setIssueItems([
                ...issueItems,
                { id: Math.random().toString(), inventoryItemId: "", quantity: "1" },
              ])
            }
          >
            <Plus className="size-4" />
            إضافة مادة أخرى
          </button>
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
