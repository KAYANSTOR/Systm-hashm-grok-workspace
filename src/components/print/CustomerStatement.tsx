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
 * كشف حساب A4 — مطابق للنموذج الرسمي المرفق.
 * الترويسة والشعار من إعدادات المنشأة؛ الأعمدة والمجاميع والشريط السفلي كما في التصميم.
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

    const minRows = 5;
    const emptyRows = Math.max(0, minRows - rows.length);

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
        {/* ترويسة من إعدادات المنشأة */}
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

        {/* شارة العنوان + رقم الحساب والعميل */}
        <div className="stmt-band-row">
          <div className="stmt-band__title">كشف حساب</div>
          <div className="stmt-party-box">
            <div className="stmt-party-line">
              <span>رقم الحساب :</span>
              <strong dir="ltr">{statement.customerNumber || "................"}</strong>
            </div>
            <div className="stmt-party-line">
              <span>العميل / المورد :</span>
              <strong>{statement.customerName || "................"}</strong>
            </div>
          </div>
        </div>

        {/* فترة التاريخ */}
        <div className="stmt-dates">
          <div className="stmt-date-field">
            <span>تاريخ :</span>
            <strong dir="ltr">{statement.periodFrom || "—"}</strong>
          </div>
          <div className="stmt-date-field">
            <span>التاريخ :</span>
            <strong dir="ltr">{statement.periodTo || "—"}</strong>
          </div>
        </div>

        {/* جدول الحركات */}
        <section className="doc-table-wrap stmt-table-wrap">
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
                    {entry.debit ? money(entry.debit) : ""}
                  </td>
                  <td className="col-number">
                    {entry.credit ? money(entry.credit) : ""}
                  </td>
                  <td className="col-number">{money(lineBalance)}</td>
                </tr>
              ))}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <tr key={`e-${i}`} className="doc-table__empty">
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}
              {!rows.length && emptyRows === 0 ? (
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
              ) : null}
            </tbody>
            <tfoot>
              <tr className="stmt-tfoot-row">
                <td colSpan={4} className="stmt-tfoot-label">
                  الإجمالي
                </td>
                <td className="col-number">
                  <span className="stmt-tfoot-cap">مجموع المدين</span>
                  {money(totalDebit)}
                </td>
                <td className="col-number">
                  <span className="stmt-tfoot-cap">مجموع الدائن</span>
                  {money(totalCredit)}
                </td>
                <td className="col-number">
                  <span className="stmt-tfoot-cap">الرصيد النهائي</span>
                  {money(closing)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ملاحظات */}
        <div className="stmt-notes">
          <span>ملاحظات :</span>
          <div className="stmt-notes__line" />
        </div>

        {/* توقيع المحاسب */}
        <div className="statement-signs">
          <div className="doc-sign">
            <div className="doc-sign__title">توقيع المحاسب</div>
            <div className="doc-sign__line" />
          </div>
        </div>

        {/* الشريط السفلي */}
        <footer className="doc-foot inv-foot">
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
        </footer>
      </div>
    );
  },
);

CustomerStatement.displayName = "CustomerStatement";
