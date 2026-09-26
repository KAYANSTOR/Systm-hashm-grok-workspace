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

function money(value: number): string {
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

/**
 * سند قبض/صرف — مطابق للنموذج الرسمي.
 * الترويسة والشعار من إعدادات المنشأة.
 */
function VoucherDocument({
  voucher,
  partyName,
  partyBalanceAfter,
  copyLabel,
}: VoucherDocumentProps) {
  const { settings, organization } = useStore();
  const type = voucher.type;
  const isReceipt = type === "receipt";
  const isPayment = type === "payment";

  const companyName =
    organization.name || settings.name || "معامل هاشم الأحمدي للتصميم والتطريز";
  const companyAddress =
    organization.address || settings.location || "صنعاء - شارع الزبيري - مقابل وزارة الدفاع";
  const companyPhones =
    organization.phone ||
    [settings.phone1, settings.phone2].filter(Boolean).join(" - ") ||
    "770 447 441 - 730 447 441";
  const logoSrc = organization.logo || "/logo-hashm.jpg";

  const partyLabel = isReceipt
    ? "استلمنا من الأخ /"
    : isPayment
      ? "صرفنا إلى الأخ /"
      : "الطرف /";
  const balanceLabel = isReceipt
    ? "الباقي له بعد هذا السند /"
    : isPayment
      ? "الباقي عليه بعد هذا السند /"
      : "الرصيد بعد السند /";

  const payMethod = methodLabel[voucher.paymentMethod] || "الصندوق";

  return (
    <div className="vch">
      {copyLabel ? <span className="vch__copy-tag">{copyLabel}</span> : null}

      {/* ترويسة من إعدادات المنشأة */}
      <header className="vch__head">
        <div className="vch__head-copy">
          <h1 className="vch__org">{companyName}</h1>
          <div className="vch__org-meta">{companyAddress}</div>
          <div className="vch__org-phone">☎ {companyPhones}</div>
        </div>
        <div className="vch__logo">
          <img src={logoSrc} alt="شعار المنشأة" />
        </div>
      </header>

      {/* الرقم + شارة العنوان + التاريخ */}
      <div className="vch-title-bar">
        <div className="vch-title-side">
          <span>الرقم :</span>
          <strong dir="ltr">{voucher.voucherNumber || "............"}</strong>
        </div>
        <div className="vch-title-pill">{voucherTitle(type)}</div>
        <div className="vch-title-side vch-title-side--date">
          <span>التاريخ :</span>
          <strong dir="ltr">{formatDate(voucher.date)}</strong>
        </div>
      </div>

      <div className="vch__body">
        {/* الطرف */}
        <div className="vch-field">
          <span className="vch-field__label">{partyLabel}</span>
          <span className="vch-field__value">{partyName || ""}</span>
          <span className="vch-field__suffix">المحترم</span>
        </div>

        {/* المبلغ */}
        <div className="vch-field vch-field--amount">
          <span className="vch-field__label">مبلغ وقدره /</span>
          <span className="vch-amount-box">
            <span className="vch-amount-box__ico" aria-hidden>
              🪙
            </span>
            <span className="vch-amount-box__num" dir="ltr">
              {money(voucher.amount)}
            </span>
            <span className="vch-amount-box__cur">ريال يمني فقط لا غير</span>
          </span>
        </div>

        {/* المبلغ كتابةً — إن وُجد */}
        <div className="vch-field vch-field--words">
          <span className="vch-field__value vch-field__value--words">
            {amountWords(voucher.amount)}
          </span>
        </div>

        {/* طريقة الدفع + التاريخ */}
        <div className="vch-field vch-field--split">
          <div>
            <span className="vch-field__label">طريقة الدفع /</span>
            <span className="vch-field__value">{payMethod}</span>
          </div>
          <div>
            <span className="vch-field__label">بتاريخ /</span>
            <span className="vch-field__value" dir="ltr">
              {formatDate(voucher.date)}
            </span>
          </div>
        </div>

        {/* وذلك مقابل */}
        <div className="vch-field">
          <span className="vch-field__label">وذلك مقابل /</span>
          <span className="vch-field__value">{voucher.description?.trim() || ""}</span>
        </div>

        {/* الباقي */}
        <div className="vch-field">
          <span className="vch-field__label">{balanceLabel}</span>
          <span className="vch-field__value" dir="ltr">
            {partyBalanceAfter !== null ? money(partyBalanceAfter) : ""}
          </span>
        </div>
      </div>

      {/* التوقيعات */}
      <div className="vch__signs">
        <div className="vch__sign">
          <div className="vch__sign-title">توقيع المستلم</div>
          <div className="vch__sign-line" />
        </div>
        <div className="vch__sign">
          <div className="vch__sign-title">أمين الصندوق</div>
          <div className="vch__sign-line" />
        </div>
      </div>

      {/* الشريط السفلي */}
      <footer className="vch__foot">
        <div className="vch__foot-main">
          <span className="inv-foot__item">
            <span className="inv-foot__ico" aria-hidden>
              ☎
            </span>
            {companyPhones}
          </span>
          <span className="inv-foot__sep" aria-hidden>
            |
          </span>
          <span className="inv-foot__item">
            <span className="inv-foot__ico" aria-hidden>
              📍
            </span>
            {companyAddress}
          </span>
        </div>
        <div className="vch__foot-name">{companyName}</div>
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

  const title = voucherTitle(voucher.type);

  return (
    <PrintPreview
      title="معاينة السند قبل الطباعة"
      subtitle={`${title} · ${partyName}`}
      paper={twoCopies ? "a4-voucher-sheet" : "receipt"}
      fileName={`${title}_${voucher.voucherNumber}`}
      shareText={`${title} ${voucher.voucherNumber} — ${partyName}`}
      onClose={onClose}
      extraAction={
        <button
          type="button"
          className="print-btn"
          onClick={() => setTwoCopies((v) => !v)}
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
        <VoucherDocument
          voucher={voucher}
          partyName={partyName}
          partyBalanceAfter={balance}
        />
      )}
    </PrintPreview>
  );
}
