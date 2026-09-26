import { forwardRef } from "react";
import { formatMoney } from "@/lib/utils";

export type StatementEntry = {
  id: string;
  date: string;
  transactionType: string;
  documentNumber?: string;
  description: string;
  debit?: number;
  credit?: number;
  documentType: string;
};

export type CustomerStatementData = {
  statementNumber: string | number;
  date: string;
  customerName: string;
  customerNumber: string;
  phone?: string;
  address?: string;
  accountType?: string;
  accountOpeningDate?: string;
  periodFrom: string;
  periodTo: string;
  entries: StatementEntry[];
  openingBalance?: number;
};

export type StatementCompany = {
  name: string;
  location: string;
  phone1: string;
  phone2: string;
  logoSrc?: string;
  footerText?: string;
};

interface Props {
  statement: CustomerStatementData;
  company: StatementCompany;
  className?: string;
}

const money = (value = 0) =>
  formatMoney(Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);

const sum = (entries: StatementEntry[], field: "debit" | "credit") =>
  entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);

/**
 * كشف حساب A4 — مطابق للنموذج الرسمي (Navy + Gold).
 * الرصيد المتراكم من حركات النظام الحقيقية.
 */
export const CustomerStatement = forwardRef<HTMLDivElement, Props>(
  ({ statement, company, className = "" }, ref) => {
    const totalDebit = sum(statement.entries, "debit");
    const totalCredit = sum(statement.entries, "credit");
    const opening = Number(statement.openingBalance) || 0;
    const closing = opening + totalDebit - totalCredit;

    let running = opening;
    const rows = statement.entries.map((entry) => {
      running += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
      return { entry, running };
    });

    const companyName =
      company.name || "معامل هاشم الأحمدي للتصميم والتطريز الإلكتروني";
    const companyAddress =
      company.location || "صنعاء - شارع الزبيري - مقابل وزارة الدفاع";
    const companyPhones =
      [company.phone1, company.phone2].filter(Boolean).join(" - ") ||
      "770 447 441 - 730 447 441";
    const logoSrc = company.logoSrc || "/logo-hashm.jpg";

    return (
      <div ref={ref} className={`statement-page ${className}`}>
        <header className="doc-head">
          <div className="doc-head__copy">
            <h1 className="doc-head__name">{companyName}</h1>
            <div className="doc-head__meta">{companyAddress}</div>
            <div className="doc-head__phones">☎ {companyPhones}</div>
          </div>
          <div className="doc-head__logo">
            <img src={logoSrc} alt="شعار المنشأة" />
          </div>
        </header>

        <div className="stmt-band">
          <div className="stmt-band__title">كشف حساب</div>
        </div>

        <div className="stmt-meta">
          <div className="stmt-meta__item">
            <span>رقم الحساب :</span>
            <strong dir="ltr">{statement.customerNumber || "—"}</strong>
          </div>
          <div className="stmt-meta__item">
            <span>العميل / المورد :</span>
            <strong>{statement.customerName || "—"}</strong>
          </div>
          <div className="stmt-meta__item">
            <span>من تاريخ :</span>
            <strong dir="ltr">{statement.periodFrom}</strong>
          </div>
          <div className="stmt-meta__item">
            <span>إلى تاريخ :</span>
            <strong dir="ltr">{statement.periodTo}</strong>
          </div>
        </div>

        <section className="doc-table-wrap">
          <table className="doc-table stmt-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>نوع المستند</th>
                <th>رقم المستند</th>
                <th>البيان</th>
                <th>مدين</th>
                <th>دائن</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, running: lineBalance }) => (
                <tr key={entry.id}>
                  <td className="col-number">{entry.date}</td>
                  <td>{entry.documentType || entry.transactionType || "—"}</td>
                  <td className="col-number">{entry.documentNumber || "—"}</td>
                  <td className="col-desc">{entry.description || "—"}</td>
                  <td className="col-number">
                    {entry.debit ? money(entry.debit) : "—"}
                  </td>
                  <td className="col-number">
                    {entry.credit ? money(entry.credit) : "—"}
                  </td>
                  <td className="col-number">{money(lineBalance)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "6mm",
                      color: "var(--print-muted)",
                    }}
                  >
                    لا توجد حركات خلال الفترة المحددة
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  الإجمالي
                </td>
                <td className="col-number">{money(totalDebit)}</td>
                <td className="col-number">{money(totalCredit)}</td>
                <td className="col-number">{money(closing)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <div className="stmt-summary">
          <div className="stmt-summary__cell">
            <span>مجموع المدين</span>
            <strong dir="ltr">{money(totalDebit)}</strong>
          </div>
          <div className="stmt-summary__cell">
            <span>مجموع الدائن</span>
            <strong dir="ltr">{money(totalCredit)}</strong>
          </div>
          <div className="stmt-summary__cell stmt-summary__cell--final">
            <span>الرصيد النهائي</span>
            <strong dir="ltr">{money(closing)}</strong>
          </div>
        </div>

        <div className="stmt-notes">
          <span>ملاحظات :</span>
          <div className="stmt-notes__line" />
        </div>

        <div className="statement-signs">
          <div className="doc-sign">
            <div className="doc-sign__title">توقيع المحاسب</div>
            <div className="doc-sign__line" />
          </div>
        </div>

        <footer className="doc-foot">
          <span>
            ☎ {companyPhones} &nbsp;|&nbsp; 📍 {companyAddress}
          </span>
          <span className="doc-foot__note">{statement.customerName}</span>
        </footer>
      </div>
    );
  },
);

CustomerStatement.displayName = "CustomerStatement";
