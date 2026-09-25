import { createLazyFileRoute } from "@tanstack/react-router";
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
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  Segmented,
  StatCard,
  StatGrid,
} from "@/components/ui/kit";
import { amountInArabicWords } from "@/lib/numbers-ar";
import VoucherPrintTemplate from "@/components/print/VoucherPrintTemplate";
import DocumentActionsSheet from "@/components/DocumentActionsSheet";
import { methodLabel, paymentMethodOptions, voucherTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { PartyKind, PaymentMethod, Voucher, VoucherType } from "@/lib/types";
import {
  amountInputError,
  cn,
  formatCurrency,
  formatDate,
  nextNumber,
  parseAmountStrict,
  todayIso,
} from "@/lib/utils";

export const Route = createLazyFileRoute("/vouchers")({ component: VouchersPage });

function VouchersPage() {
  const vouchers = useStore((s) => s.vouchers);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const addVoucher = useStore((s) => s.addVoucher);
  const deleteVoucher = useStore((s) => s.deleteVoucher);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | VoucherType>("all");
  const [open, setOpen] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  const [actionsId, setActionsId] = useState<string | null>(null);

  const [voucherNumber, setVoucherNumber] = useState("");
  const [type, setType] = useState<VoucherType>("receipt");
  const [partyType, setPartyType] = useState<PartyKind>("customer");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [description, setDescription] = useState("");

  const partyName = useCallback((v: Voucher) => {
    if (v.partyType === "customer") return customers.find((c) => c.id === v.partyId)?.name || "—";
    if (v.partyType === "supplier") return suppliers.find((s) => s.id === v.partyId)?.name || "—";
    return "أخرى";
  }, [customers, suppliers]);

  const filtered = useMemo(
    () =>
      vouchers
        .filter((v) => filter === "all" || v.type === filter)
        .filter(
          (v) =>
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
    setDate(todayIso());
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
    const finalDescription =
      description.trim() ||
      (type === "receipt"
        ? `قبض من ${partyName || "جهة أخرى"}`
        : `صرف إلى ${partyName || "جهة أخرى"}`);
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
    // رصيد العميل: موجب = عليه. رصيد المورد: موجب = له علينا (اتفاقية العرض).
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

  const printing = vouchers.find((v) => v.id === printId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="السندات"
        subtitle="قبض من العملاء وصرف للموردين — كل سند يُرحَّل على الذمة والصندوق معًا."
        icon={Receipt}
        tone="good"
        actions={
          <>
            <button type="button" className="btn-success" onClick={() => openNew("receipt")}>
              <ArrowDownRight className="size-5" />
              سند قبض
            </button>
            <button type="button" className="btn-danger" onClick={() => openNew("payment")}>
              <ArrowUpRight className="size-5" />
              سند صرف
            </button>
          </>
        }
      />

      <StatGrid cols={3}>
        <StatCard
          label="إجمالي القبض"
          value={formatCurrency(totals.receiptTotal)}
          icon={ArrowDownRight}
          tone="good"
          hint={`${vouchers.filter((v) => v.type === "receipt").length} سند`}
        />
        <StatCard
          label="إجمالي الصرف"
          value={formatCurrency(totals.paymentTotal)}
          icon={ArrowUpRight}
          tone="bad"
          hint={`${vouchers.filter((v) => v.type === "payment").length} سند`}
        />
        <StatCard
          label="صافي حركة السندات"
          value={formatCurrency(totals.net)}
          icon={Wallet}
          tone={totals.net >= 0 ? "brand" : "accent"}
          hint="قبض − صرف"
        />
      </StatGrid>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="ابحث برقم السند أو الطرف أو البيان…"
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "receipt", "payment"] as const).map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "الكل" : voucherTypeLabel[f]}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={Receipt} title="لا توجد سندات" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const inn = v.type === "receipt";
            return (
              <article key={v.id} className="list-row group">
                <span className={cn("tile-icon", inn ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                  {inn ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-black text-ink">{partyName(v)}</h3>
                    <Chip tone={inn ? "good" : "bad"}>{voucherTypeLabel[v.type]}</Chip>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-muted">
                    <span className="num">{v.voucherNumber}</span> · {formatDate(v.date)} ·{" "}
                    {methodLabel[v.paymentMethod]} · {v.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money
                    value={formatCurrency(v.amount)}
                    tone={inn ? "good" : "bad"}
                    className="text-sm"
                  />
                  <button
                    type="button"
                    className="btn-icon size-8"
                    onClick={() => setPrintId(v.id)}
                    aria-label="طباعة السند"
                  >
                    <Printer className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon size-8 text-bad hover:bg-bad-soft hover:text-bad"
                    aria-label="حذف السند"
                    onClick={() => {
                      if (confirm("حذف السند وعكس أثره؟")) {
                        deleteVoucher(v.id);
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
                  الطرف
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
            title={type === "receipt" ? "المبلغ المقبوض" : "المبلغ المصروف"}
            description="اكتب رقمًا واحدًا فقط — ولن يُقبل أي نص مخلوط"
            icon={Calculator}
          >
            <MoneyField
              label="المبلغ"
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
              <FieldLabel>طريقة الدفع</FieldLabel>
              <AppSelect
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                searchable={false}
                options={paymentMethodOptions.map((option) => ({ value: option.value, label: option.label }))}
              />
            </div>
          </FormSection>

          <FormSection
            title="البيان"
            description="سبب السند — يظهر مطبوعًا وفي دفتر القيود"
            icon={NotebookPen}
            tone="warn"
          >
            <TextField
              label="البيان"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === "receipt" ? "مثال: دفعة على حساب تطريز 200 قطعة" : "مثال: سداد دفعة لمورد الخيوط"
              }
              hint="اتركه فارغًا وسيُكتب بيان تلقائي واضح بدل سند بلا بيان."
            />
          </FormSection>

          <TotalsBar
            title="ملخص السند"
            lines={[
              { label: "نوع السند", value: voucherTypeLabel[type] },
              { label: "الطرف", value: partyType === "other" ? "أخرى" : partyId ? "محدد" : "لم يُحدد" },
              {
                label: "المبلغ",
                value: formatCurrency(voucherAmount),
                tone: type === "receipt" ? "good" : "bad",
                strong: true,
              },
              {
                label: balanceAfter === null ? "الرصيد بعد السند" : "رصيد الطرف بعد السند",
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
