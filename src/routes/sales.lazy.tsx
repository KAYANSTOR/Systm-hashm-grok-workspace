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
import { methodLabel, paymentTypeLabel, statusLabel, unitLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type {
  Invoice,
  InvoiceKind,
  InvoiceLine,
  InvoiceSalesType,
  PaymentMethod,
  PaymentType,
} from "@/lib/types";
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
  const deleteInvoice = useStore((s) => s.deleteInvoice);
  const approveInvoice = useStore((s) => s.approveInvoice);
  const defaultWarehouseId = useStore((s) => s.defaultWarehouseId || "wh1");
  const warehouses = useStore((s) => s.warehouses || []);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const cancelInvoice = useStore((s) => s.cancelInvoice);

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
  const [serviceUnit, setServiceUnit] = useState("قطعة");

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
          return (
            i.invoiceNumber.includes(q) ||
            (party || "").includes(q)
          );
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
    setDiscount("0");
    setPaidAmount("0");
    setPaymentType("cash");
    setPaymentMethod("cash");
    setNotes("");
    setSupplierName("");
    setWarehouseId(defaultWarehouseId);
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
    setSupplierName(inv.partyId === "PENDING_RECEIPT" ? "" : suppliers.find((supplier) => supplier.id === inv.partyId)?.name || "");
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
    // إدخال صارم: "3س" أو "1.2.5" كان يُقرأ سابقًا كرقم صامتًا فيُحفظ بند بسعر/كمية غير المقصود.
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
      setItems((prev) => [
        ...prev,
        {
          id: uid("l"),
          inventoryItemId: "SERVICE",
          name: serviceName.trim(),
          description: serviceDesc,
          quantity,
          unit: serviceUnit,
          unitPrice,
          total: quantity * unitPrice,
        },
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
    const isPendingReceipt = Boolean(editing && invoices.find((invoice) => invoice.id === editing)?.partyId === "PENDING_RECEIPT");
    let resolvedPartyId = partyId;
    if (isPendingReceipt && !resolvedPartyId && supplierName.trim()) {
      resolvedPartyId = addSupplier({ name: supplierName.trim(), phone: "", company: supplierName.trim(), balance: 0 });
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
        if (current?.isApproved) {
          setActionsId(editing);
          toast.success("تم اعتماد الفاتورة");
        } else {
          toast.error("تعذر اعتماد الفاتورة — راجع الكميات أو البيانات");
          return;
        }
      } else {
        toast.success("تم تحديث المسودة");
      }
    } else {
      const id = addInvoice(payload);
      if (!id) return; // domain/application rejected
      if (approved) setActionsId(id);
      toast.success(approved ? "تم اعتماد الفاتورة" : "حُفظت كمسودة");
    }
    setOpen(false);
  };

  const printing = invoices.find((i) => i.id === printId);
  const pendingReceiptReview = Boolean(editing && invoices.find((invoice) => invoice.id === editing)?.partyId === "PENDING_RECEIPT");

  // اقتراحات الخدمات السابقة: نفس البيان يتكرر في المعمل كثيرًا (تطريز 100 قطعة…)؛
  // الاقتراح يوفّر الكتابة ويوحّد التسميات في الفواتير والتقارير.
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
        const merged = { ...item, ...patch };
        return { ...merged, total: (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0) };
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
            {/* فواتير بيع/شراء البضاعة مخفية عن الواجهة (FEATURES.PRODUCT_SALES = false)
                — المنطق كامل في الكود، والقديم يبقى في القائمة أدناه للتعديل والطباعة. */}
            {PRODUCT_SALES ? (
              <button type="button" className="btn-primary" onClick={() => openModal("sale", "PRODUCT_SALE")}>
                <Plus className="size-5" />
                بيع بضاعة
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={() => openModal("sale", "SERVICE")}
            >
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
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="بحث برقم الفاتورة أو اسم الطرف…"
          className="flex-1"
        />
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
                      <span className="num font-mono text-[11px] font-bold text-muted">
                        {inv.invoiceNumber}
                      </span>
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
                      <span className={inv.status === "paid" ? "text-good" : inv.status === "partial" ? "text-warn" : "text-bad"}>
                        {statusLabel[inv.status]}
                      </span>
                      {" · "}
                      {paymentTypeLabel[inv.paymentType]}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-line/70 pt-3">
                  <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setPrintId(inv.id)}>
                    <Printer className="size-4" />
                    طباعة
                  </button>
                  {!inv.isApproved ? (
                    <>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() => openEdit(inv)}
                      >
                        <Pencil className="size-4" />
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-primary px-3 py-2 text-xs"
                        onClick={() => {
                          const ok = approveInvoice(inv.id);
                          if (ok) {
                            setActionsId(inv.id);
                            toast.success("تم الاعتماد");
                          }
                        }}
                      >
                        <CheckCircle2 className="size-4" />
                        اعتماد
                      </button>
                    </>
                  ) : inv.isCancelled ? (
                    <span className="inline-flex items-center gap-1 px-2 text-xs font-bold text-muted">
                      ملغاة
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 text-xs font-bold text-good">
                        <CheckCircle2 className="size-4" />
                        معتمدة
                      </span>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-2 text-xs text-bad"
                        onClick={() => {
                          if (!confirm("إلغاء الفاتورة المعتمدة؟ سيتم عكس أثرها على المخزون والحسابات مع الإبقاء على السجل.")) return;
                          const ok = cancelInvoice(inv.id);
                          if (ok) toast.success("تم إلغاء الفاتورة وعكس آثارها");
                        }}
                      >
                        إلغاء
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn-icon size-9 text-bad shrink-0"
                    onClick={() => {
                      if (confirm("حذف الفاتورة؟")) {
                        deleteInvoice(inv.id);
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
        title={
          pendingReceiptReview
            ? "مطابقة أمر التوريد المخزني"
            : editing
              ? "تعديل فاتورة"
              : mode.kind === "purchase"
                ? "فاتورة مشتريات"
                : mode.salesType === "SERVICE"
                  ? "فاتورة خدمة تطريز"
                  : "فاتورة بيع بضاعة"
        }
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-ghost" onClick={() => save(false)}>
              حفظ مسودة
            </button>
            <button type="button" className="btn-primary" onClick={() => save(true)}>
              حفظ واعتماد
            </button>
          </>
        }
      >
        <FormSection
          title="بيانات الفاتورة"
          description="الرقم والطرف والتاريخ — الرقم يُقترح تلقائيًا ويمكن تعديله"
          icon={Receipt}
        >
          <FormGrid cols={3}>
            <TextField
              label="رقم الفاتورة"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              className="num"
            />
            <div>
              <FieldLabel icon={UserRound} required>
                {mode.kind === "sale" ? "العميل" : "المورد"}
              </FieldLabel>
              <AppSelect
                value={partyId}
                onChange={setPartyId}
                searchable
                placeholder="ابحث بالاسم أو الرقم…"
                options={parties.map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: `الرصيد الحالي: ${formatCurrency(Number(p.balance) || 0)}${p.phone ? ` · ${p.phone}` : ""}`,
                }))}
              />
            </div>
            <AppDatePicker label="التاريخ" value={date} onChange={setDate} />
          </FormGrid>

          {pendingReceiptReview ? (
            <TextField
              label="اسم المورد الجديد"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="أدخل اسم المورد"
              hint="اكتب اسم المورد ثم اختر الأصناف وأسعار الشراء قبل الاعتماد."
            />
          ) : null}

          <div>
            <FieldLabel>المخزن</FieldLabel>
            <AppSelect
              value={warehouseId}
              onChange={setWarehouseId}
              options={(warehouses || [])
                .filter((w) => w.isActive !== false)
                .map((w) => ({ value: w.id, label: w.name || w.id }))}
              searchable={false}
            />
          </div>

          {partyId ? (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line/70 bg-canvas/60 p-2.5">
              <div className="rounded-xl bg-paper px-3 py-2">
                <p className="text-[10px] font-black text-muted">الرصيد الحالي</p>
                <Money value={formatCurrency(previousBalance)} className="text-sm text-ink" />
              </div>
              <div className="rounded-xl bg-paper px-3 py-2">
                <p className="text-[10px] font-black text-muted">الرصيد بعد هذه الفاتورة</p>
                <Money
                  value={formatCurrency(grandTotal)}
                  tone={grandTotal > 0 ? "bad" : "good"}
                  className="text-sm"
                />
              </div>
            </div>
          ) : null}

          {pendingReceiptReview ? (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand-dark">
              تم تحميل الأصناف التي أرسلها مستلم المخزن. راجع القائمة وعدّل الكمية أو سعر الشراء قبل الاعتماد.
            </p>
          ) : null}
        </FormSection>

        <FormSection
          title={mode.salesType === "SERVICE" ? "بنود خدمة التطريز" : "بنود الفاتورة"}
          description="اكتب البيان والكمية والسعر ثم اضغط Enter — البند يُضاف فورًا"
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
          <div
            className="rounded-2xl border border-line/70 bg-canvas/50 p-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLine();
              }
            }}
          >
            {mode.kind === "sale" && mode.salesType === "SERVICE" ? (
              <div className="grid gap-3 sm:grid-cols-6">
                <TextField
                  label="البيان / اسم الخدمة"
                  icon={Tag}
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="مثال: تطريز 100 قطعة"
                  className="sm:col-span-3"
                />
                <TextField
                  label="الوحدة"
                  value={serviceUnit}
                  onChange={(e) => setServiceUnit(e.target.value)}
                  placeholder="قطعة"
                  className="sm:col-span-1"
                />
                <TextField
                  label="الكمية"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  error={lineError(qty)}
                  className="num sm:col-span-1"
                />
                <MoneyField
                  label="سعر الوحدة"
                  value={price}
                  onChange={setPrice}
                  error={lineError(price)}
                  className="sm:col-span-1"
                />
                <TextField
                  label="وصف تفصيلي (اختياري)"
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                  placeholder="نوع القماش أو لون الخيط…"
                  className="sm:col-span-4"
                />
                <div className="flex items-end sm:col-span-2">
                  <button type="button" className="btn-primary w-full" onClick={addLine}>
                    <Plus className="size-4" />
                    إضافة البند
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <FieldLabel required>المادة</FieldLabel>
                  <AppSelect
                    value={itemId}
                    onChange={(value) => {
                      setItemId(value);
                      const selected = inventory.find((item) => item.id === value);
                      if (selected) setPrice(String(mode.kind === "sale" ? selected.sellingPrice : selected.costPrice));
                    }}
                    searchable
                    placeholder="ابحث عن المادة…"
                    options={inventory.map((item) => ({
                      value: item.id,
                      label: item.name,
                      description: `المتاح: ${item.quantity} · التكلفة: ${formatCurrency(item.costPrice)}`,
                    }))}
                  />
                </div>
                <TextField
                  label="الكمية"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  error={lineError(qty)}
                  className="num"
                />
                <MoneyField
                  label="سعر الوحدة"
                  value={price}
                  onChange={setPrice}
                  error={lineError(price)}
                />
                <div className="flex items-end sm:col-span-4">
                  <button type="button" className="btn-primary w-full sm:w-auto" onClick={addLine}>
                    <Plus className="size-4" />
                    إضافة البند
                  </button>
                </div>
              </div>
            )}
          </div>

          {serviceSuggestions.length > 0 && mode.salesType === "SERVICE" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-muted">خدمات سابقة:</span>
              {serviceSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip-filter"
                  onClick={() => setServiceName(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70">
              {items.map((line, idx) => (
                <li key={line.id} className="bg-paper p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {pendingReceiptReview ? (
                        <input
                          className="input-field"
                          value={line.name}
                          placeholder="اسم الصنف"
                          onChange={(e) => updateLine(idx, { name: e.target.value })}
                        />
                      ) : (
                        <>
                          <p className="truncate text-sm font-black text-ink">
                            {idx + 1}. {line.name}
                          </p>
                          {line.description ? (
                            <p className="truncate text-[11px] font-bold text-muted">{line.description}</p>
                          ) : null}
                        </>
                      )}
                    </div>
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
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                      inputMode="decimal"
                      className="num"
                    />
                    <MoneyField
                      label="سعر الوحدة"
                      value={String(line.unitPrice)}
                      onChange={(value) => updateLine(idx, { unitPrice: Number(value.replace(/[^\d.]/g, "")) || 0 })}
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
                      <p className="text-[10px] font-black text-muted">إجمالي البند</p>
                      <Money value={formatCurrency(line.total)} className="text-sm text-brand-dark" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs font-bold text-muted">
              لم تُضَف بنود بعد — ابدأ بإضافة أول بند من الأعلى.
            </p>
          )}
        </FormSection>

        <FormSection
          title="الدفع والملاحظات"
          description="طريقة السداد والخصم ثم البيان الذي يُطبع على الفاتورة"
          icon={Wallet}
          tone="good"
        >
          <FormGrid cols={3}>
            <MoneyField
              label="الخصم"
              icon={Tag}
              value={discount}
              onChange={setDiscount}
              error={lineError(discount)}
              hint="اتركه صفرًا إن لم يوجد خصم."
            />
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
                  options={Object.entries(methodLabel).map(([value, label]) => ({ value, label }))}
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
            placeholder="مثال: تطريز 100 قطعة قماش قطن — تسليم بعد 5 أيام"
            hint="يظهر هذا البيان في الفاتورة المطبوعة وفي التقرير."
          />
        </FormSection>

        <TotalsBar
          title="ملخص الفاتورة"
          lines={[
            { label: `عدد البنود (${items.length})`, value: itemsCount },
            { label: "الإجمالي قبل الخصم", value: formatCurrency(subTotal) },
            { label: "الخصم", value: formatCurrency(disc), tone: disc > 0 ? "bad" : "muted" },
            { label: "إجمالي الفاتورة", value: formatCurrency(total), strong: true },
            { label: "المدفوع", value: formatCurrency(paid), tone: "good" },
            { label: "المتبقي", value: formatCurrency(Math.max(0, remaining)), tone: remaining > 0 ? "bad" : "good" },
            { label: "الرصيد السابق", value: formatCurrency(previousBalance) },
            { label: "الرصيد بعد الفاتورة", value: formatCurrency(grandTotal), strong: true },
          ]}
        />
      </Modal>

      {printing ? (
        <InvoicePrintTemplate
          invoice={printing}
          partyName={
            printing.partyId
              ? customers.find((c) => c.id === printing.partyId)?.name ||
                suppliers.find((s) => s.id === printing.partyId)?.name ||
                "نقدي"
              : "نقدي"
          }
          onClose={() => setPrintId(null)}
        />
      ) : null}
      <DocumentActionsSheet
        open={Boolean(actionsId)}
        title="الفاتورة"
        phone={(() => {
          const invoice = invoices.find((item) => item.id === actionsId);
          const party = invoice?.type === "purchase"
            ? suppliers.find((item) => item.id === invoice.partyId)
            : customers.find((item) => item.id === invoice?.partyId);
          return party?.phone;
        })()}
        onClose={() => setActionsId(null)}
        onPrint={() => {
          setPrintId(actionsId);
          setActionsId(null);
        }}
      />
    </div>
  );
}
