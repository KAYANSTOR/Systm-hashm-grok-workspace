import { useState } from "react";
import { Copy, FileText } from "lucide-react";
import type { Voucher, VoucherType } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { methodLabel } from "@/lib/labels";
import { amountWords } from "@/lib/numbers-ar";
import { useStore } from "@/lib/store";
import PrintPreview from "./PrintPreview";

interface VoucherPrintTemplateProps {
  voucher: Voucher;
  partyName: string;
  onClose: () => void;
}

function numeric(value: number): string {
  return formatMoney(Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

function voucherTitle(type: VoucherType): string {
  if (type === "receipt") return "سند قبض";
  if (type === "payment") return "سند صرف";
  if (type === "deferred") return "سند آجل";
  return "سند قيد";
}

interface VoucherDocumentProps {
  voucher: Voucher;
  partyName: string;
  partyBalanceAfter: number | null;
  copyLabel?: string;
}

function VoucherDocument({
  voucher,
  partyName,
  partyBalanceAfter,
  copyLabel,
}: VoucherDocumentProps) {
  const { settings: companySettings, organization } = useStore();
  const type = voucher.type;
  const isReceipt = type === "receipt";
  const isPayment = type === "payment";
  const partyLabel = isReceipt ? "استلمنا من :" : isPayment ? "المسلم :" : "الطرف :";
  const purposeLabel = "مقابل :";
  const companyName = organization.name || companySettings.name;
  const companyAddress = organization.address || companySettings.location;
  const companyPhones =
    organization.phone ||
    [companySettings.phone1, companySettings.phone2].filter(Boolean).join(" · ");

  return (
    <div className="vch">
      {copyLabel ? <span className="vch__copy-tag">{copyLabel}</span> : null}

      <header className="vch__head">
        <div className="vch__head-copy">
          <h1 className="vch__org">{companyName}</h1>
          <div className="vch__org-meta">{companyAddress}</div>
          <div className="vch__org-phone">{companyPhones}</div>
        </div>
        <div className="vch__logo">
          <img src={organization.logo || "/favicon.svg"} alt="شعار المنشأة" />
        </div>
      </header>

      <div className="vch__band">
        <div className="vch__band-cell vch__band-cell--date">
          <span>التاريخ</span>
          <strong>{formatDate(voucher.date)}</strong>
        </div>
        <div className="vch__title">{voucherTitle(type)}</div>
        <div className="vch__band-cell vch__band-cell--number">
          <span>رقم السند</span>
          <strong>{voucher.voucherNumber}</strong>
        </div>
      </div>

      <div className="vch__body">
        <div className="vch__row">
          <span className="vch__label">{partyLabel}</span>
          <span className="vch__fill">{partyName || "—"}</span>
          <span className="vch__label">المحترم</span>
        </div>

        <div className="vch__row">
          <span className="vch__label">المبلغ :</span>
          <span className="vch__fill vch__amount">{numeric(voucher.amount)}</span>
          <span className="vch__label">ريال يمني</span>
          <span className="vch__label vch__currency">فقط لا غير</span>
          <span className="vch__words">{amountWords(voucher.amount, "ريال يمني")}</span>
        </div>

        <div className="vch__meta-row">
          <span className="vch__meta-label">طريقة الدفع :</span>
          <span className="vch__meta-fill vch__meta-fill--tight">
            {methodLabel[voucher.paymentMethod]}
          </span>
          <span className="vch__meta-label">بتاريخ /</span>
          <span className="vch__meta-fill">{formatDate(voucher.date)}</span>
        </div>

        <div className="vch__meta-row">
          <span className="vch__meta-label">{purposeLabel}</span>
          <span className="vch__meta-fill">{voucher.description || "—"}</span>
        </div>

        {partyBalanceAfter !== null ? (
          <div className="vch__meta-row">
            <span className="vch__meta-label">الرصيد بعد العملية :</span>
            <span className="vch__meta-fill">{numeric(partyBalanceAfter)}</span>
          </div>
        ) : null}
      </div>

      <footer className="vch__foot">
        <div className="vch__sign">
          <div className="vch__sign-title">أمين الصندوق</div>
          <div className="vch__sign-line">{companySettings.name}</div>
        </div>
        <div className="vch__sign">
          <div className="vch__sign-title">المستلم</div>
          <div className="vch__sign-line">{partyName || "—"}</div>
        </div>
      </footer>
    </div>
  );
}

export default function VoucherPrintTemplate({
  voucher,
  partyName,
  onClose,
}: VoucherPrintTemplateProps) {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const [twoCopies, setTwoCopies] = useState(true);

  const balance = (() => {
    if (voucher.partyType === "customer") {
      const party = customers.find((item) => item.id === voucher.partyId);
      if (!party) return null;
      return voucher.type === "receipt"
        ? (Number(party.balance) || 0) - voucher.amount
        : (Number(party.balance) || 0) + voucher.amount;
    }
    if (voucher.partyType === "supplier") {
      const party = suppliers.find((item) => item.id === voucher.partyId);
      if (!party) return null;
      return voucher.type === "payment"
        ? (Number(party.balance) || 0) - voucher.amount
        : (Number(party.balance) || 0) + voucher.amount;
    }
    return null;
  })();

  return (
    <PrintPreview
      title="معاينة السند قبل الطباعة"
      subtitle={`${voucherTitle(voucher.type)} · ${partyName}`}
      paper={twoCopies ? "a4-voucher-sheet" : "receipt"}
      fileName={`${voucherTitle(voucher.type)}_${voucher.voucherNumber}`}
      shareText={`${voucherTitle(voucher.type)} ${voucher.voucherNumber} — ${partyName}`}
      onClose={onClose}
      extraAction={
        <button
          type="button"
          className="print-btn"
          onClick={() => setTwoCopies((value) => !value)}
          title="تبديل بين ورقة A4 بنسختين ونصف ورقة"
        >
          {twoCopies ? <FileText className="size-4" /> : <Copy className="size-4" />}
          <span>{twoCopies ? "نسخة واحدة" : "نسختان (A4)"}</span>
        </button>
      }
    >
      {twoCopies ? (
        <div className="vch-sheet">
          <VoucherDocument
            voucher={voucher}
            partyName={partyName}
            partyBalanceAfter={balance}
            copyLabel="الأصل — الصندوق"
          />
          <div className="vch-sheet__cut">✂ ——————————————————————————————</div>
          <VoucherDocument
            voucher={voucher}
            partyName={partyName}
            partyBalanceAfter={balance}
            copyLabel="صورة — العميل"
          />
        </div>
      ) : (
        <VoucherDocument voucher={voucher} partyName={partyName} partyBalanceAfter={balance} />
      )}
    </PrintPreview>
  );
}
