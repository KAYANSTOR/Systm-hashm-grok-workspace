import { createLazyFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  NotebookPen,
  Plus,
  Printer,
  Receipt,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentActionsSheet } from "@/components/DocumentActionsSheet";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { AppSelect } from "@/components/ui/AppSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { StatCard } from "@/components/ui/StatCard";
import {
  FieldLabel,
  FormGrid,
  FormSection,
  MoneyField,
  TextField,
  TotalsBar,
} from "@/components/ui/form";
import {
  SearchField,
} from "@/components/ui/SearchField";
import VoucherPrintTemplate from "@/components/print/VoucherPrintTemplate";
import { amountInArabicWords } from "@/lib/numbers-ar";
import { methodLabel, paymentMethodOptions, voucherTypeLabel } from "@/lib/labels";
import { voucherFieldLabels } from "@/lib/voucher-fields";
import { useStore } from "@/lib/store";
import type { PartyKind, PaymentMethod, Voucher, VoucherType } from "@/lib/types";
import {
  amountInputError,
  formatCurrency,
  formatDate,
  nextNumber,
  parseAmountStrict,
} from "@/lib/utils";

export const Route = createLazyFileRoute("/vouchers")({ component: VouchersPage });

function VouchersPage() {
  const vouchers = useStore((s) => s.vouchers);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const addVoucher = useStore((s) => s.addVoucher);
  const deleteVoucher = useStore((s) => s.deleteVoucher);

  const [filter, setFilter] = useState<"all" | VoucherType>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  const [actionsId, setActionsId] = useState<string | null>(null);

  const [voucherNumber, setVoucherNumber] = useState("");
  const [type, setType] = useState<VoucherType>("receipt");
  const [partyType, setPartyType] = useState<PartyKind>("customer");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [description, setDescription] = useState("");

  const partyName = useCallback((v: Voucher) => {
    if (v.partyType === "customer") return customers.find((c) => c.id === v.partyId)?.name || "—";
    if (v.partyType === "supplier") return suppliers.find((s) => s.id === v.partyId)?.name || "—";
    return "جهة أخرى";
  }, [customers, suppliers]);

  const filtered = useMemo(
    () =>
      vouchers
        .filter((v) => filter === "all" || v.type === filter)
        .filter(
          (v) =>
            !q ||
            v.voucherNumber.includes(q) ||
            v.description.includes(q) ||
            partyName(v).includes(q),
        ),
    [vouchers, filter, q, partyName],
  );

  const openNew = (t: VoucherType) => {
    const prefix = t === "receipt" ? "REC" : t === "payment" ? "PAY" : "JOU";
    setVoucherNumber(nextNumber(vouchers.filter((v) => v.type === t).map((v) => v.voucherNumber), prefix));
    setType(t);
    setPartyType(t === "receipt" ? "customer" : t === "payment" ? "supplier" : "other");
    setPartyId("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("cash");
    setDescription("");
    setOpen(true);
  };

  const save = () => {
    // إدخال صارم: "12س" أو "1.2.5" كان يُقبل سابقًا كرقم صامتًا فيُحفظ مبلغ غير المقصود.
    const parsed = parseAmountStrict(amount);
    if (!parsed.ok) return toast.error(amountInputError(parsed.reason, "المبلغ"));
    if (parsed.value <= 0) return toast.error("المبلغ يجب أن يكون أكبر من صفر");
    if (partyType !== "other" && !partyId) {
      return toast.error(partyType === "customer" ? "اختر العميل" : "اختر المورد");
    }
    const partyName =
      partyType === "customer"
        ? customers.find((c) => c.id === partyId)?.name
        : partyType === "supplier"
          ? suppliers.find((s) => s.id === partyId)?.name
          : undefined;
    // بيان تلقائي واضح بدل سند بلا بيان (يظهر في السند المطبوع ودفتر القيود).
    const fields = voucherFieldLabels(type);
    const finalDescription =
      description.trim() || fields.autoDescriptionPrefix(partyName || "");
    const id = addVoucher({
      voucherNumber,
      type,
      partyType,
      partyId: partyId || undefined,
      amount: parsed.value,
      date,
      paymentMethod,
      description: finalDescription,
    });
    toast.success("تم حفظ السند");
    setPrintId(id);
    setOpen(false);
  };

  const parties = partyType === "customer" ? customers : partyType === "supplier" ? suppliers : [];

  /** رصيد الطرف المختار حاليًا وبعد أثر السند مباشرة. */
  const selectedPartyBalance = (() => {
    if (!partyId) return null;
    if (partyType === "customer") return customers.find((c) => c.id === partyId)?.balance ?? null;
    if (partyType === "supplier") return suppliers.find((s) => s.id === partyId)?.balance ?? null;
    return null;
  })();

  const parsedAmount = parseAmountStrict(amount);
  const voucherAmount = parsedAmount.ok ? parsedAmount.value : 0;

  const balanceAfter = (() => {
    if (selectedPartyBalance === null) return null;
    if (partyType === "customer") {
      return type === "receipt"
        ? selectedPartyBalance - voucherAmount
        : selectedPartyBalance + voucherAmount;
    }
    return type === "payment"
      ? selectedPartyBalance - voucherAmount
      : selectedPartyBalance + voucherAmount;
  })();

  const totals = useMemo(() => {
    const receiptTotal = vouchers.filter((v) => v.type === "receipt").reduce((s, v) => s + v.amount, 0);
    const paymentTotal = vouchers.filter((v) => v.type === "payment").reduce((s, v) => s + v.amount, 0);
    return { receiptTotal, paymentTotal, net: receiptTotal - paymentTotal };
  }, [vouchers]);

  const printing = printId ? vouchers.find((v) => v.id === printId) : null;

  return (
    <div className="page-shell space-y-4">
      <PageHeader
        title="السندات"
        description="سندات القبض والصرف — رقم تسلسلي تلقائي وطباعة رسمية"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-success" onClick={() => openNew("receipt")}>
              <ArrowDownRight className="size-4" />
              سند قبض
            </button>
            <button type="button" className="btn-danger" onClick={() => openNew("payment")}>
              <ArrowUpRight className="size-4" />
              سند صرف
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="إجمالي القبض"
          value={formatCurrency(totals.receiptTotal)}
          tone="good"
          hint={`${vouchers.filter((v) => v.type === "receipt").length} سند`}
        />
        <StatCard
          label="إجمالي الصرف"
          value={formatCurrency(totals.paymentTotal)}
          tone="bad"
          hint={`${vouchers.filter((v) => v.type === "payment").length} سند`}
        />
        <StatCard
          label="صافي حركة السندات"
          value={formatCurrency(totals.net)}
          tone="brand"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="بحث بالرقم أو الطرف أو البيان…"
        />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={
            ([
              { value: "all" as const, label: "الكل" },
              { value: "receipt" as const, label: "قبض" },
              { value: "payment" as const, label: "صرف" },
            ]).map((f) => ({
              value: f.value,
              label: f.label,
            }))
          }
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد سندات"
          description="أنشئ سند قبض أو صرف من الأزرار أعلاه"
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((v) => {
            const inn = v.type === "receipt";
            return (
              <article key={v.id} className="card-surface flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`badge ${inn ? "badge-success" : "badge-danger"}`}
                    >
                      {voucherTypeLabel[v.type]}
                    </span>
                    <span className="num">{v.voucherNumber}</span> · {formatDate(v.date)} ·{" "}
                    {methodLabel[v.paymentMethod]} · {v.description}
                  </div>
                  <p className="mt-1 text-sm font-bold text-ink">{partyName(v)}</p>
                </div>
                <Money
                  value={formatCurrency(v.amount)}
                  tone={inn ? "good" : "bad"}
                  className="text-base"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label="طباعة السند"
                    onClick={() => setPrintId(v.id)}
                  >
                    <Printer className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-danger"
                    aria-label="حذف السند"
                    onClick={() => {
                      if (confirm("حذف هذا السند؟")) deleteVoucher(v.id);
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
        title={voucherTypeLabel[type]}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              <Plus className="size-4" />
              حفظ
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <Segmented
            value={type}
            onChange={(t) => {
              setType(t);
              setPartyType(t === "receipt" ? "customer" : t === "payment" ? "supplier" : "other");
              setPartyId("");
            }}
            options={[
              { value: "receipt" as VoucherType, label: "سند قبض", icon: ArrowDownRight },
              { value: "payment" as VoucherType, label: "سند صرف", icon: ArrowUpRight },
            ]}
          />

          <FormSection
            title="بيانات السند"
            description="الرقم والنوع والطرف — الرقم يُقترح تلقائيًا"
            icon={Receipt}
            tone={type === "receipt" ? "good" : "bad"}
          >
            <FormGrid cols={3}>
              <TextField
                label="رقم السند"
                value={voucherNumber}
                onChange={() => undefined}
                readOnly
                className="num"
              />
              <div>
                <FieldLabel required>نوع الطرف</FieldLabel>
                <AppSelect
                  value={partyType}
                  onChange={(v) => {
                    setPartyType(v as PartyKind);
                    setPartyId("");
                  }}
                  searchable={false}
                  options={[
                    { value: "customer", label: "عميل" },
                    { value: "supplier", label: "مورد" },
                    { value: "other", label: "أخرى" },
                  ]}
                />
              </div>
              <AppDatePicker value={date} onChange={setDate} label="التاريخ" />
            </FormGrid>

            {partyType !== "other" ? (
              <div>
                <FieldLabel icon={UserRound} required>
                  {voucherFieldLabels(type).partyFieldLabel}
                </FieldLabel>
                <AppSelect
                  value={partyId}
                  onChange={setPartyId}
                  searchable
                  placeholder="ابحث بالاسم أو الرقم…"
                  options={parties.map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: `الرصيد: ${formatCurrency(Number(p.balance) || 0)}${p.phone ? ` · ${p.phone}` : ""}`,
                  }))}
                />
                {selectedPartyBalance !== null ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="card-sunken px-3 py-2">
                      <p className="text-[11px] font-black text-muted">الرصيد الحالي</p>
                      <Money value={formatCurrency(selectedPartyBalance)} className="text-sm text-ink" />
                    </div>
                    <div className="card-sunken px-3 py-2">
                      <p className="text-[11px] font-black text-muted">بعد هذا السند</p>
                      {balanceAfter !== null ? (
                        <Money
                          value={formatCurrency(balanceAfter)}
                          tone={balanceAfter < 0 ? "good" : "brand"}
                          className="text-sm"
                        />
                      ) : (
                        <span className="text-sm font-black text-muted">—</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </FormSection>

          <FormSection
            title={voucherFieldLabels(type).amountSectionTitle}
            description="اكتب رقمًا واحدًا فقط — ولن يُقبل أي نص مخلوط"
            icon={Calculator}
          >
            <MoneyField
              label={voucherFieldLabels(type).amountFieldLabel}
              required
              value={amount}
              onChange={setAmount}
              error={parsedAmount.ok ? undefined : amountInputError(parsedAmount.reason, "المبلغ")}
              hint="المبلغ كتابةً يظهر تلقائيًا في السند المطبوع."
            />
            {voucherAmount > 0 ? (
              <span className="flex items-start gap-2 rounded-2xl bg-brand-soft/70 px-3 py-2 text-[11px] font-bold text-brand-dark">
                <Calculator className="mt-0.5 size-3.5 shrink-0" />
                {amountInArabicWords(voucherAmount)}
              </span>
            ) : null}
            <div>
              <FieldLabel>{voucherFieldLabels(type).paymentMethodLabel.replace(/\s*\/\s*$/, "")}</FieldLabel>
              <AppSelect
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                searchable={false}
                options={paymentMethodOptions.map((option) => ({ value: option.value, label: option.label }))}
              />
            </div>
          </FormSection>

          <FormSection
            title={voucherFieldLabels(type).descriptionLabel.replace(/\s*\/\s*$/, "")}
            description="سبب السند — يظهر مطبوعًا وفي دفتر القيود"
            icon={NotebookPen}
            tone="warn"
          >
            <TextField
              label={voucherFieldLabels(type).descriptionLabel.replace(/\s*\/\s*$/, "")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={voucherFieldLabels(type).descriptionPlaceholder}
              hint="اتركه فارغًا وسيُكتب بيان تلقائي واضح بدل سند بلا بيان."
            />
          </FormSection>

          <TotalsBar
            title="ملخص السند"
            lines={[
              { label: "نوع السند", value: voucherTypeLabel[type] },
              {
                label: voucherFieldLabels(type).partyFieldLabel,
                value: partyType === "other" ? "أخرى" : partyId ? "محدد" : "لم يُحدد",
              },
              {
                label: voucherFieldLabels(type).amountFieldLabel,
                value: formatCurrency(voucherAmount),
                tone: type === "receipt" ? "good" : "bad",
                strong: true,
              },
              {
                label: voucherFieldLabels(type).balanceAfterLabel.replace(/\s*\/\s*$/, ""),
                value: balanceAfter === null ? "—" : formatCurrency(balanceAfter),
              },
            ]}
          />
        </div>
      </Modal>

      {printing ? (
        <VoucherPrintTemplate
          voucher={printing}
          partyName={partyName(printing)}
          onClose={() => setPrintId(null)}
        />
      ) : null}
      <DocumentActionsSheet
        open={Boolean(actionsId)}
        title={vouchers.find((item) => item.id === actionsId)?.type === "payment" ? "سند الصرف" : "سند القبض"}
        phone={(() => {
          const voucher = vouchers.find((item) => item.id === actionsId);
          const party = voucher?.partyType === "supplier"
            ? suppliers.find((item) => item.id === voucher.partyId)
            : customers.find((item) => item.id === voucher?.partyId);
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
