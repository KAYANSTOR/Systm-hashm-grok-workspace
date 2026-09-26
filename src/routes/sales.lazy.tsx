import { createLazyFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, CheckCircle2,
  Layers,
  Pencil,
  Plus,
  Printer,
  Receipt,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { AppSelect } from "@/components/ui/AppSelect";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { FieldLabel, FormGrid, FormSection, MoneyField, TextField, TotalsBar } from "@/components/ui/form";
import {
  Chip,
  FilterChip,
  Money,
  PageHeader,
  SearchField,
  StatCard,
  StatGrid,
} from "@/components/ui/kit";
import InvoicePrintTemplate from "@/components/print/InvoicePrintTemplate";
import DocumentActionsSheet from "@/components/DocumentActionsSheet";
import { ServiceItemsPanel } from "@/components/sales/ServiceItemsPanel";
import { methodLabel, paymentMethodOptions, paymentTypeLabel, statusLabel, unitLabel } from "@/lib/labels";
import { invoiceFieldLabels } from "@/lib/invoice-fields";
import { useStore } from "@/lib/store";
import type {
  EmbroideryUnit,
  Invoice,
  InvoiceKind,
  InvoiceLine,
  InvoiceSalesType,
  PaymentMethod,
  PaymentType,
} from "@/lib/types";
import {
  buildServiceLine,
  patchServiceLine,
  resolveEmbroideryUnit,
} from "@/lib/embroidery";
import {
  amountInputError,
  formatCurrency,
  formatDate,
  invoiceStatus,
  nextNumber,
  parseAmountStrict,
  todayIso,
  uid,
} from "@/lib/utils";
import { PRODUCT_SALES } from "@/lib/features";

export const Route = createLazyFileRoute("/sales")({ component: SalesPage });

type Mode = { kind: InvoiceKind; salesType: InvoiceSalesType };

function SalesPage() {
  const invoices = useStore((s) => s.invoices);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const inventory = useStore((s) => s.inventory);
  const addInvoice = useStore((s) => s.addInvoice);
  const addSupplier = useStore((s) => s.addSupplier);
  const updateInvoice = useStore((s) => s.updateInvoice);
  const defaultWarehouseId = useStore((s) => s.defaultWarehouseId || "wh1");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | InvoiceKind>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "sale", salesType: "PRODUCT_SALE" });
  const [editing, setEditing] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [actionsId, setActionsId] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [supplierName, setSupplierName] = useState("");

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceUnit, setServiceUnit] = useState<EmbroideryUnit>("taqa");

  const parties = mode.kind === "sale" ? customers : suppliers;

  const filtered = useMemo(
    () =>
      invoices
        .filter((i) => (filter === "all" ? true : i.type === filter))
        .filter((i) => {
          const party =
            i.type === "sale"
              ? customers.find((c) => c.id === i.partyId)?.name
              : suppliers.find((s) => s.id === i.partyId)?.name;
          return i.invoiceNumber.includes(q) || (party || "").includes(q);
        }),
    [invoices, filter, q, customers, suppliers],
  );

  const openModal = (kind: InvoiceKind, salesType: InvoiceSalesType = "PRODUCT_SALE") => {
    setMode({ kind, salesType });
    setEditing(null);
    const prefix = kind === "sale" ? "INV" : "PUR";
    setInvoiceNumber(nextNumber(invoices.filter((i) => i.type === kind).map((i) => i.invoiceNumber), prefix));
    setPartyId("");
    setDate(todayIso());
    setWarehouseId(defaultWarehouseId);
    setItems([]);
    setServiceName("");
    setServiceDesc("");
    setServiceUnit("taqa");
    setQty("1");
    setPrice("");
    setDiscount("0");
    setPaidAmount("0");
    setPaymentType("cash");
    setPaymentMethod("cash");
    setNotes("");
    setSupplierName("");
    setOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    if (inv.isApproved) {
      toast.error("لا يمكن تعديل فاتورة معتمدة");
      return;
    }
    setMode({ kind: inv.type, salesType: inv.invoiceType || "PRODUCT_SALE" });
    setEditing(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setPartyId(inv.partyId === "PENDING_RECEIPT" ? "" : inv.partyId);
    setSupplierName(inv.partyId === "PENDING_RECEIPT" ? "" : suppliers.find((s) => s.id === inv.partyId)?.name || "");
    setDate(inv.date);
    setWarehouseId(inv.warehouseId || defaultWarehouseId);
    setItems(inv.items);
    setDiscount(String(inv.discount));
    setPaidAmount(String(inv.paidAmount));
    setPaymentType(inv.paymentType);
    setPaymentMethod(inv.paymentMethod || "cash");
    setNotes(inv.notes || "");
    setOpen(true);
  };

  const addLine = () => {
    const parsedQty = parseAmountStrict(qty);
    if (!parsedQty.ok) return toast.error(amountInputError(parsedQty.reason, "الكمية"));
    if (parsedQty.value <= 0) return toast.error("الكمية يجب أن تكون أكبر من صفر");
    const parsedPrice = parseAmountStrict(price);
    if (!parsedPrice.ok && price.trim() !== "") {
      return toast.error(amountInputError(parsedPrice.reason, "سعر الوحدة"));
    }
    const quantity = parsedQty.value;
    const unitPrice = parsedPrice.ok ? parsedPrice.value : 0;
    if (mode.kind === "sale" && mode.salesType === "SERVICE") {
      if (!serviceName.trim()) return toast.error("أدخل البيان / اسم الخدمة");
      if (unitPrice <= 0) return toast.error("أدخل سعر الوحدة");
      setItems((prev) => [
        ...prev,
        buildServiceLine({
          id: uid("l"),
          name: serviceName.trim(),
          description: serviceDesc,
          serviceUnit,
          serviceQuantity: quantity,
          serviceUnitPrice: unitPrice,
        }),
      ]);
      setServiceName("");
      setServiceDesc("");
      setQty("1");
      setPrice("");
      return;
    }
    const invItem = inventory.find((i) => i.id === itemId);
    if (!invItem) return toast.error("اختر مادة");
    const finalPrice =
      unitPrice || (mode.kind === "sale" ? invItem.sellingPrice : invItem.costPrice);
    setItems((prev) => [
      ...prev,
      {
        id: uid("l"),
        inventoryItemId: invItem.id,
        name: invItem.name,
        quantity,
        unit: unitLabel[invItem.unit],
        unitPrice: finalPrice,
        total: quantity * finalPrice,
      },
    ]);
    setItemId("");
    setQty("1");
    setPrice("");
  };

  const subTotal = items.reduce((s, i) => s + i.total, 0);
  const parsedDiscount = parseAmountStrict(discount);
  const disc = parsedDiscount.ok ? parsedDiscount.value : 0;
  const total = Math.max(0, subTotal - disc);
  const parsedPaid = parseAmountStrict(paidAmount);
  const paid =
    paymentType === "cash" ? total : paymentType === "deferred" ? 0 : parsedPaid.ok ? parsedPaid.value : 0;
  const remaining = total - paid;
  const status = invoiceStatus(total, paid);
  const previousBalance = parties.find((party) => party.id === partyId)?.balance || 0;
  const grandTotal = previousBalance + (mode.kind === "sale" ? remaining : -remaining);

  const save = (approved: boolean) => {
    if (items.length === 0) return toast.error("أضف بنداً واحداً على الأقل");
    const isPendingReceipt = Boolean(
      editing && invoices.find((invoice) => invoice.id === editing)?.partyId === "PENDING_RECEIPT",
    );
    let resolvedPartyId = partyId;
    if (isPendingReceipt && !resolvedPartyId && supplierName.trim()) {
      resolvedPartyId = addSupplier({
        name: supplierName.trim(),
        phone: "",
        company: supplierName.trim(),
        balance: 0,
      });
    }
    if (!resolvedPartyId) {
      return toast.error(
        mode.kind === "sale" ? "اختر العميل قبل الحفظ" : "اختر المورد أو أدخل اسم المورد",
      );
    }
    const payload = {
      invoiceNumber,
      type: mode.kind,
      invoiceType: mode.kind === "sale" ? mode.salesType : undefined,
      partyId: resolvedPartyId,
      date,
      items,
      subTotal,
      discount: disc,
      total,
      paidAmount: paid,
      paymentType,
      paymentMethod,
      remainingAmount: remaining,
      status,
      isApproved: approved,
      warehouseId,
      notes,
    };
    if (editing) {
      updateInvoice(editing, payload);
      const current = useStore.getState().invoices.find((x) => x.id === editing);
      if (approved) {
        if (current?.isApproved) toast.success("تم اعتماد الفاتورة");
        else {
          toast.error("تعذر اعتماد الفاتورة — راجع الكميات أو البيانات");
          return;
        }
      } else toast.success("تم تحديث المسودة");
    } else {
      const id = addInvoice(payload);
      if (!id) return;
      setPrintId(id);
      toast.success(approved ? "تم اعتماد الفاتورة" : "حُفظت كمسودة");
    }
    setOpen(false);
  };

  const printing = invoices.find((i) => i.id === printId);
  const pendingReceiptReview = Boolean(
    editing && invoices.find((invoice) => invoice.id === editing)?.partyId === "PENDING_RECEIPT",
  );

  const serviceSuggestions = useMemo(() => {
    const names = invoices
      .filter((invoice) => invoice.invoiceType === "SERVICE")
      .flatMap((invoice) => invoice.items.map((item) => item.name.trim()))
      .filter(Boolean);
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [invoices]);

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (
          mode.salesType === "SERVICE" ||
          item.inventoryItemId === "SERVICE" ||
          resolveEmbroideryUnit(item)
        ) {
          return patchServiceLine(item, {
            name: patch.name,
            description: patch.description,
            serviceUnit: patch.serviceUnit,
            serviceQuantity:
              patch.serviceQuantity !== undefined
                ? patch.serviceQuantity
                : patch.quantity !== undefined
                  ? patch.quantity
                  : undefined,
            serviceUnitPrice:
              patch.serviceUnitPrice !== undefined
                ? patch.serviceUnitPrice
                : patch.unitPrice !== undefined
                  ? patch.unitPrice
                  : undefined,
          });
        }
        const merged = { ...item, ...patch };
        return {
          ...merged,
          total: (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0),
        };
      }),
    );
  };

  const lineError = (raw: string): string | undefined => {
    const parsed = parseAmountStrict(raw);
    if (raw.trim() === "") return undefined;
    if (!parsed.ok) return "رقم غير صحيح";
    return undefined;
  };

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const itemsCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const serviceDraftQty = parseAmountStrict(qty);
  const serviceDraftPrice = parseAmountStrict(price);
  const serviceDraftTotal =
    serviceDraftQty.ok && serviceDraftPrice.ok
      ? serviceDraftQty.value * serviceDraftPrice.value
      : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={PRODUCT_SALES ? "المبيعات والمشتريات" : "خدمات التطريز"}
        subtitle={
          PRODUCT_SALES
            ? "فواتير البضاعة، خدمات التطريز، والمشتريات."
            : "إنشاء فاتورة خدمة تطريز ومتابعة فواتير الخدمات."
        }
        icon={Sparkles}
        tone="accent"
        actions={
          <>
            {PRODUCT_SALES ? (
              <button type="button" className="btn-primary" onClick={() => openModal("sale", "PRODUCT_SALE")}>
                <Plus className="size-5" />
                بيع بضاعة
              </button>
            ) : null}
            <button type="button" className="btn-primary" onClick={() => openModal("sale", "SERVICE")}>
              <Plus className="size-5" />
              {PRODUCT_SALES ? "خدمة تطريز" : "فاتورة خدمة تطريز"}
            </button>
            {PRODUCT_SALES ? (
              <button type="button" className="btn-secondary" onClick={() => openModal("purchase")}>
                <Plus className="size-5" />
                مشتريات
              </button>
            ) : null}
          </>
        }
      />

      <StatGrid cols={3}>
        <StatCard
          label={PRODUCT_SALES ? "إجمالي المبيعات" : "إجمالي خدمات التطريز"}
          value={formatCurrency(
            invoices
              .filter((i) => i.type === "sale" && i.isApproved && !i.isCancelled)
              .reduce((s, i) => s + i.total, 0),
          )}
          icon={Sparkles}
          tone="brand"
          hint={`${invoices.filter((i) => i.type === "sale" && i.isApproved).length} فاتورة معتمدة`}
        />
        <StatCard
          label="غير مسدَّد"
          value={formatCurrency(
            invoices
              .filter((i) => i.type === "sale" && i.isApproved && !i.isCancelled)
              .reduce((s, i) => s + (i.remainingAmount || 0), 0),
          )}
          icon={AlertTriangle}
          tone="accent"
          hint="ذمم على العملاء"
        />
        <StatCard
          label="بانتظار الاعتماد"
          value={invoices.filter((i) => !i.isApproved && !i.isCancelled).length}
          icon={CheckCircle2}
          tone="warn"
          hint="مسودة أو أمر توريد"
        />
      </StatGrid>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <SearchField value={q} onChange={setQ} placeholder="بحث برقم الفاتورة أو اسم الطرف…" className="flex-1" />
        <div className="flex flex-wrap gap-2">
          {(["all", "sale", ...(PRODUCT_SALES ? (["purchase"] as const) : [])] as const).map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "الكل" : f === "sale" ? (PRODUCT_SALES ? "مبيعات" : "خدمات") : "مشتريات"}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShoppingBag}
            title="لا توجد فواتير"
            hint={PRODUCT_SALES ? "ابدأ بفاتورة بيع بضاعة أو خدمة تطريز." : "ابدأ بفاتورة خدمة تطريز."}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const party =
              inv.type === "sale"
                ? customers.find((c) => c.id === inv.partyId)?.name
                : suppliers.find((s) => s.id === inv.partyId)?.name;
            return (
              <article key={inv.id} className="card card-hover p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="num font-mono text-[11px] font-bold text-muted">{inv.invoiceNumber}</span>
                      <Chip tone={inv.invoiceType === "SERVICE" ? "accent" : "muted"}>
                        {inv.type === "purchase"
                          ? "مشتريات"
                          : inv.invoiceType === "SERVICE"
                            ? "خدمة تطريز"
                            : "بيع بضاعة"}
                      </Chip>
                      {inv.isCancelled ? <Chip tone="bad">ملغاة</Chip> : null}
                    </div>
                    <h3 className="mt-1 truncate font-black text-ink">
                      {inv.partyId === "PENDING_RECEIPT" ? (
                        <span className="flex items-center gap-1 text-warn">
                          <AlertTriangle className="size-4" /> توريد مخزني (بانتظار المطابقة)
                        </span>
                      ) : (
                        party || "—"
                      )}
                    </h3>
                    <p className="text-[11px] font-bold text-muted">{formatDate(inv.date)}</p>
                  </div>
                  <div className="text-left">
                    <Money value={formatCurrency(inv.total)} className="text-lg text-ink" />
                    <p className="mt-0.5 text-[11px] font-bold text-muted">
                      <span
                        className={
                          inv.status === "paid"
                            ? "text-good"
                            : inv.status === "partial"
                              ? "text-warn"
                              : "text-bad"
                        }
                      >
                        {statusLabel[inv.status]}
                      </span>
                      {" · "}
                      {paymentTypeLabel[inv.paymentType]}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setPrintId(inv.id)}>
                    <Printer className="size-4" /> طباعة
                  </button>
                  {!inv.isApproved && !inv.isCancelled ? (
                    <button type="button" className="btn-secondary" onClick={() => openEdit(inv)}>
                      <Pencil className="size-4" /> تعديل
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary" onClick={() => setActionsId(inv.id)}>
                    <Receipt className="size-4" /> إجراءات
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={invoiceFieldLabels(mode.kind, mode.kind === "sale" ? mode.salesType : undefined).formTitle}
        wide
      >
        <div className="space-y-4">
          <FormSection title="بيانات الفاتورة" icon={Receipt} tone="brand">
            <FormGrid cols={3}>
              <TextField label="رقم الفاتورة" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="num" />
              <AppDatePicker label="التاريخ" value={date} onChange={setDate} />
              <div>
                <FieldLabel required>
                  {invoiceFieldLabels(mode.kind, mode.kind === "sale" ? mode.salesType : undefined).partyFieldLabel}
                </FieldLabel>
                <AppSelect
                  value={partyId}
                  onChange={setPartyId}
                  options={parties.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder={mode.kind === "sale" ? "اختر العميل" : "اختر المورد"}
                />
              </div>
            </FormGrid>
          </FormSection>

          <FormSection
            title={invoiceFieldLabels(mode.kind, mode.kind === "sale" ? mode.salesType : undefined).itemsSectionTitle}
            description={
              invoiceFieldLabels(mode.kind, mode.kind === "sale" ? mode.salesType : undefined)
                .itemsSectionHint
            }
            icon={Layers}
            tone="warn"
            action={
              items.length ? (
                <Chip tone="brand">
                  {items.length} بند · {formatCurrency(itemsTotal)}
                </Chip>
              ) : null
            }
          >
            <div className="rounded-2xl border border-line/70 bg-canvas/50 p-3">
              {mode.kind === "sale" && mode.salesType === "SERVICE" ? (
                <ServiceItemsPanel
                  serviceName={serviceName}
                  setServiceName={setServiceName}
                  serviceDesc={serviceDesc}
                  setServiceDesc={setServiceDesc}
                  serviceUnit={serviceUnit}
                  setServiceUnit={setServiceUnit}
                  qty={qty}
                  setQty={setQty}
                  price={price}
                  setPrice={setPrice}
                  serviceDraftTotal={serviceDraftTotal}
                  lineError={lineError}
                  onAddLine={addLine}
                  items={items}
                  updateLine={updateLine}
                  removeLine={(index) => setItems((previous) => previous.filter((_, i) => i !== index))}
                  serviceSuggestions={serviceSuggestions}
                  pendingReceiptReview={pendingReceiptReview}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <FieldLabel required>الصنف</FieldLabel>
                    <AppSelect
                      value={itemId}
                      onChange={setItemId}
                      options={inventory.map((item) => ({
                        value: item.id,
                        label: item.name,
                        description: `المتاح: ${item.quantity} · التكلفة: ${formatCurrency(item.costPrice)}`,
                      }))}
                    />
                  </div>
                  <TextField label="الكمية" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" error={lineError(qty)} className="num" />
                  <MoneyField label="سعر الوحدة" value={price} onChange={setPrice} error={lineError(price)} />
                  <div className="flex items-end sm:col-span-4">
                    <button type="button" className="btn-primary w-full sm:w-auto" onClick={addLine}>
                      <Plus className="size-4" />
                      إضافة البند
                    </button>
                  </div>
                </div>
              )}
            </div>

            {mode.salesType !== "SERVICE" && items.length > 0 ? (
              <ul className="mt-3 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70">
                {items.map((line, idx) => (
                  <li key={line.id} className="bg-paper p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="truncate text-sm font-black text-ink">
                        {idx + 1}. {line.name}
                      </p>
                      <button
                        type="button"
                        className="btn-icon size-8 text-bad hover:bg-bad-soft hover:text-bad"
                        aria-label={`حذف البند ${idx + 1}`}
                        onClick={() => setItems((previous) => previous.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                      <TextField
                        label="الكمية"
                        value={String(line.quantity)}
                        onChange={(e) =>
                          updateLine(idx, {
                            quantity: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                          })
                        }
                        inputMode="decimal"
                        className="num"
                      />
                      <MoneyField
                        label="سعر الوحدة"
                        value={String(line.unitPrice)}
                        onChange={(value) =>
                          updateLine(idx, {
                            unitPrice: Number(value.replace(/[^\d.]/g, "")) || 0,
                          })
                        }
                      />
                      <div>
                        <FieldLabel>الوحدة</FieldLabel>
                        <input
                          className="input-field"
                          value={line.unit || ""}
                          onChange={(e) => updateLine(idx, { unit: e.target.value })}
                          placeholder="قطعة"
                        />
                      </div>
                      <div className="rounded-2xl bg-brand-soft/70 px-3 py-2 text-center">
                        <p className="text-[11px] font-black text-muted">إجمالي البند</p>
                        <Money value={formatCurrency(line.total)} className="text-sm text-brand-dark" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </FormSection>

          <FormSection title="الدفع والملاحظات" description="طريقة السداد والخصم ثم البيان" icon={Wallet} tone="good">
            <FormGrid cols={3}>
              <MoneyField label="الخصم" icon={Tag} value={discount} onChange={setDiscount} error={lineError(discount)} />
              <div>
                <FieldLabel required>طريقة الدفع</FieldLabel>
                <AppSelect
                  value={paymentType}
                  onChange={(value) => setPaymentType(value as PaymentType)}
                  searchable={false}
                  options={[
                    { value: "cash", label: "نقدي — يُسدَّد كاملًا" },
                    { value: "deferred", label: "آجل — على الحساب" },
                    { value: "partial", label: "جزئي — دفعة الآن" },
                  ]}
                />
              </div>
              {paymentType !== "deferred" ? (
                <div>
                  <FieldLabel>عبر شبكة</FieldLabel>
                  <AppSelect
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    searchable={false}
                    options={paymentMethodOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </div>
              ) : null}
              {paymentType === "partial" ? (
                <MoneyField
                  label="المدفوع الآن"
                  value={paidAmount}
                  onChange={setPaidAmount}
                  error={lineError(paidAmount)}
                  hint={`المتبقي بعد الدفعة: ${formatCurrency(Math.max(0, total - paid))}`}
                />
              ) : null}
            </FormGrid>
            <TextField
              label="البيان / ملاحظات الفاتورة"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تطريز 100 قطعة — تسليم بعد 5 أيام"
            />
          </FormSection>

          <TotalsBar
            title="ملخص الفاتورة"
            lines={[
              { label: `عدد البنود (${items.length})`, value: itemsCount },
              { label: "الإجمالي قبل الخصم", value: formatCurrency(subTotal) },
              { label: "الخصم", value: formatCurrency(disc), tone: disc > 0 ? "bad" : "muted" },
              { label: "إجمالي الفاتورة", value: formatCurrency(total), strong: true },
            ]}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-secondary" onClick={() => save(false)}>
              حفظ مسودة
            </button>
            <button type="button" className="btn-primary" onClick={() => save(true)}>
              <CheckCircle2 className="size-4" />
              اعتماد وحفظ
            </button>
          </div>
        </div>
      </Modal>

      {printing ? (
        <InvoicePrintTemplate
          invoice={printing}
          partyName={
            printing.type === "sale"
              ? customers.find((c) => c.id === printing.partyId)?.name || ""
              : suppliers.find((s) => s.id === printing.partyId)?.name || ""
          }
          onClose={() => setPrintId(null)}
        />
      ) : null}

      <DocumentActionsSheet
        open={Boolean(actionsId)}
        title="الفاتورة"
        onClose={() => setActionsId(null)}
        onPrint={() => {
          setPrintId(actionsId);
          setActionsId(null);
        }}
      />
    </div>
  );
}
