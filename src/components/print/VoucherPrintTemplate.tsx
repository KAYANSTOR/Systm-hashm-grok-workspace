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

/**
 * نموذج السند الورقي (210×105 مم) — تصميم واحد يُستخدم للمعاينة والطباعة.
 *
 * كل النصوص بخط Cairo الحقيقي المُحمَّل في الصفحة (كان القالب القديم يشير إلى ملف
 * خط غير موجود `/fonts/Cairo-*.woff2` فيسقط إلى خط احتياطي). والطباعة الآن متجهية
 * بلا تحويل إلى صورة، فالحروف تخرج حادة بمقاسها الصحيح على الورق.
 */
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
  const partyLabel = isReceipt ? "استلمنا من الأخ /" : isPayment ? "صرفنا إلى الأخ /" : "الطرف /";
  const purposeLabel = isReceipt ? "وذلك مقابل /" : isPayment ? "وذلك مقابل /" : "وذلك مقابل /";
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
          <span>الرقم</span>
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
          <span className="vch__label">مبلغ وقدره /</span>
          <span className="vch__fill vch__amount">{numeric(voucher.amount)}</span>
          <span className="vch__label">ريال يمني</span>
          <span className="vch__label vch__currency">فقط لا غير</span>
          <span className="vch__words">{amountWords(voucher.amount, "ريال يمني")}</span>
        </div>

        <div className="vch__meta-row">
          <span className="vch__meta-label">طريقة الدفع /</span>
          <span className="vch__meta-fill vch__meta-fill--tight">
            {methodLabel[voucher.paymentMethod]}
          </span>
          <span className="vch__meta-label">بتاريخ /</span>
          <span className="vch__meta-fill">{formatDate(voucher.date)}</span>
          <span className="vch__meta-label">م</span>
        </div>

        <div className="vch__row">
          <span className="vch__label">{purposeLabel}</span>
          <span className="vch__fill">{voucher.description || "—"}</span>
        </div>

        <div className="vch__meta-row">
          <span className="vch__meta-label">
            {partyBalanceAfter === null
              ? "الباقي بعد هذا السند /"
              : partyBalanceAfter >= 0
                ? "الباقي على الطرف بعد هذا السند /"
                : "الباقي له بعد هذا السند /"}
          </span>
          <span className="vch__meta-fill vch__meta-fill--tight">
            {partyBalanceAfter === null ? "—" : `${numeric(Math.abs(partyBalanceAfter))} ر.ي`}
          </span>
        </div>
      </div>

      <footer className="vch__foot">
        <div className="vch__sign">
          <div className="vch__sign-title">أمين الصندوق</div>
          <div className="vch__sign-line">{companySettings.name}</div>
        </div>
        <div className="vch__sign">
          <div className="vch__sign-title">توقيع المستلم</div>
          <div className="vch__sign-line">{partyName || "—"}</div>
        </div>
      </footer>
    </div>
  );
}

/**
 * يُعرض السند بنسختين بشكل افتراضي (أصل للصندوق + صورة للعميل) على ورقة A4 —
 * وهذا ما تحتاجه دفاتر السندات فعليًا. ويمكن تبديله إلى ورقة واحدة بارتفاع
 * نصف A4 لمن يطبع على ورق مقطوع مسبقًا.
 */
export default function VoucherPrintTemplate({
  voucher,
  partyName,
  onClose,
}: VoucherPrintTemplateProps) {
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const [twoCopies, setTwoCopies] = useState(true);

  // الرصيد بعد أثر السند مباشرة — يظهر مطبوعًا في سطر «الباقي».
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
