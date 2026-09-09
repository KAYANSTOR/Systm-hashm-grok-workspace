import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, CheckCircle2,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { AppSelect } from "@/components/ui/AppSelect";
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
import { formatCurrency, formatDate, invoiceStatus, nextNumber, todayIso, uid } from "@/lib/utils";

export const Route = createFileRoute("/sales")({ component: SalesPage });

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
    const quantity = parseFloat(qty) || 1;
    const unitPrice = parseFloat(price) || 0;
    if (mode.kind === "sale" && mode.salesType === "SERVICE") {
      if (!serviceName.trim()) return toast.error("أدخل اسم الخدمة");
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
  const disc = parseFloat(discount) || 0;
  const total = Math.max(0, subTotal - disc);
  const paid =
    paymentType === "cash" ? total : paymentType === "deferred" ? 0 : parseFloat(paidAmount) || 0;
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
    if (!resolvedPartyId) return toast.error("اختر المورد أو أدخل اسم المورد");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">المبيعات والمشتريات</h1>
          <p className="page-subtitle">فواتير البضاعة، خدمات التطريز، والمشتريات.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => openModal("sale", "PRODUCT_SALE")}>
            <Plus className="size-5" />
            بيع بضاعة
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-brand-fg"
            onClick={() => openModal("sale", "SERVICE")}
          >
            <Plus className="size-5" />
            خدمة تطريز
          </button>
          <button type="button" className="btn-secondary" onClick={() => openModal("purchase")}>
            <Plus className="size-5" />
            مشتريات
          </button>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            className="input-field pr-10"
            placeholder="بحث برقم الفاتورة أو اسم الطرف…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "sale", "purchase"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${filter === f ? "bg-brand text-brand-fg" : "bg-canvas text-muted"}`}
            >
              {f === "all" ? "الكل" : f === "sale" ? "مبيعات" : "مشتريات"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShoppingBag} title="لا توجد فواتير" hint="ابدأ بفاتورة بيع بضاعة أو خدمة تطريز." />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const party =
              inv.type === "sale"
                ? customers.find((c) => c.id === inv.partyId)?.name
                : suppliers.find((s) => s.id === inv.partyId)?.name;
            return (
              <article key={inv.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-muted">{inv.invoiceNumber}</p>
                    <h3 className="font-black">{inv.partyId === "PENDING_RECEIPT" ? <span className="text-warn flex items-center gap-1"><AlertTriangle className="size-4" /> توريد مخزني (بانتظار المطابقة)</span> : (party || "—")}</h3>
                    <p className="text-xs text-muted">
                      {formatDate(inv.date)} ·{" "}
                      {inv.type === "purchase"
                        ? "مشتريات"
                        : inv.invoiceType === "SERVICE"
                          ? "خدمة تطريز"
                          : "بيع بضاعة"}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black tabular-nums">{formatCurrency(inv.total)}</p>
                    <span
                      className={`text-xs font-bold ${inv.status === "paid" ? "text-good" : inv.status === "partial" ? "text-warn" : "text-bad"}`}
                    >
                      {statusLabel[inv.status]} · {paymentTypeLabel[inv.paymentType]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-line pt-3">
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
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="label">الرقم</span>
            <input className="input-field" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </label>
          <label>
            <span className="label">المطلوب من الأخ</span>
            <select className="input-field" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">اختر…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {pendingReceiptReview ? (
            <label>
              <span className="label">اسم المورد الجديد</span>
              <input className="input-field" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="أدخل اسم المورد" />
            </label>
          ) : null}
          <label>
            <span className="label">التاريخ</span>
            <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div>
            <AppSelect
              label="المخزن"
              value={warehouseId}
              onChange={setWarehouseId}
              options={(warehouses || [])
                .filter((w) => w.isActive !== false)
                .map((w) => ({ value: w.id, label: w.name || w.id }))}
              searchable={false}
            />
          </div>
        </div>

        {pendingReceiptReview ? (
          <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand">تم تحميل الأصناف التي أرسلها مستلم المخزن. راجع القائمة وعدّل الكمية أو سعر الشراء قبل الاعتماد.</p>
        ) : null}

        <div className="mt-4 rounded-2xl border border-line bg-canvas/50 p-3">
          {mode.kind === "sale" && mode.salesType === "SERVICE" ? (
            <div className="grid gap-2 sm:grid-cols-4">
              <input className="input-field sm:col-span-2" placeholder="البيان / اسم الخدمة" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
              <input className="input-field" placeholder="الوحدة" value={serviceUnit} onChange={(e) => setServiceUnit(e.target.value)} />
              <input className="input-field" inputMode="decimal" placeholder="الكمية" value={qty} onChange={(e) => setQty(e.target.value)} />
              <input className="input-field sm:col-span-2" placeholder="وصف البيان" value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} />
              <input className="input-field" inputMode="decimal" placeholder="سعر الوحدة" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button type="button" className="btn-primary" onClick={addLine}>
                إضافة
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-4">
              <select className="input-field sm:col-span-2" value={itemId} onChange={(e) => {
                setItemId(e.target.value);
                const it = inventory.find((i) => i.id === e.target.value);
                if (it) setPrice(String(mode.kind === "sale" ? it.sellingPrice : it.costPrice));
              }}>
                <option value="">اختر المادة…</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — المتاح {i.quantity}
                  </option>
                ))}
              </select>
              <input className="input-field" inputMode="decimal" placeholder="الكمية" value={qty} onChange={(e) => setQty(e.target.value)} />
              <input className="input-field" inputMode="decimal" placeholder="سعر الوحدة" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button type="button" className="btn-primary sm:col-span-4" onClick={addLine}>
                إضافة بند
              </button>
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {items.map((line, idx) => (
              <li key={line.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                {pendingReceiptReview ? (
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <input className="input-field" value={line.name} placeholder="اسم الصنف" onChange={(e) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === idx ? { ...item, name: e.target.value } : item))} />
                    <input className="input-field" inputMode="decimal" value={line.quantity} placeholder="الكمية" onChange={(e) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === idx ? { ...item, quantity: Number(e.target.value) || 0, total: (Number(e.target.value) || 0) * item.unitPrice } : item))} />
                    <input className="input-field" inputMode="decimal" value={line.unitPrice} placeholder="سعر الشراء" onChange={(e) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === idx ? { ...item, unitPrice: Number(e.target.value) || 0, total: item.quantity * (Number(e.target.value) || 0) } : item))} />
                  </div>
                ) : (
                  <div>
                    <p className="font-bold">{line.name}</p>
                    <p className="text-xs text-muted">{line.quantity} {line.unit} × {formatCurrency(line.unitPrice)}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-black tabular-nums">{formatCurrency(line.total)}</span>
                  <button type="button" className="text-bad" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label>
            <span className="label">الخصم</span>
            <input className="input-field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </label>
          <label>
            <span className="label">طريقة الدفع</span>
            <select
              className="input-field"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
            >
              <option value="cash">نقدي</option>
              <option value="deferred">آجل</option>
              <option value="partial">جزئي</option>
            </select>
          </label>
          {paymentType !== "deferred" && (
            <label>
              <span className="label">عبر شبكة</span>
              <select
                className="input-field"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {Object.entries(methodLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          {paymentType === "partial" ? (
            <label>
              <span className="label">المدفوع</span>
              <input className="input-field" inputMode="decimal" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </label>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
        <label className="mt-3 block">
          <span className="label">البيان</span>
          <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="mt-4 rounded-2xl bg-brand-soft p-4 text-sm">
          <div className="flex justify-between font-bold">
            <span>اجمالي الفاتورة</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted">
            <span>الرصيد السابق</span>
            <span className="tabular-nums">{formatCurrency(previousBalance)}</span>
          </div>
          <div className="mt-1 flex justify-between font-black text-accent">
            <span>الاجمالي الكلي</span>
            <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
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
