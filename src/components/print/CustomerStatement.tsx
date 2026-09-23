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
 * كشف حساب A4 — يعرض الحركة بالترتيب الزمني مع **رصيد متراكم** لكل سطر،
 * فالعميل يرى كيف تحرّك رصيده بعد كل فاتورة أو سند، لا المجاميع وحدها.
 */
export const CustomerStatement = forwardRef<HTMLDivElement, Props>(
  ({ statement, company, className = "" }, ref) => {
    const totalDebit = sum(statement.entries, "debit");
    const totalCredit = sum(statement.entries, "credit");
    const opening = Number(statement.openingBalance) || 0;
    const closing = opening + totalDebit - totalCredit;
    const isSupplier = statement.accountType === "مورد";
    const partyWord = isSupplier ? "المورد" : "العميل";

    let running = opening;
    const rows = statement.entries.map((entry) => {
      running += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
      return { entry, running };
    });

    return (
      <div ref={ref} className={`statement-page ${className}`}>
        <header className="doc-head">
          <div className="doc-head__copy">
            <h1 className="doc-head__name">{company.name}</h1>
            <div className="doc-head__meta">{company.location}</div>
            <div className="doc-head__phones">
              {[company.phone1, company.phone2].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="doc-head__logo">
            {company.logoSrc ? (
              <img src={company.logoSrc} alt="شعار المنشأة" />
            ) : (
              <img src="/favicon.svg" alt="شعار المنشأة" />
            )}
          </div>
        </header>

        <section className="doc-band">
          <div className="doc-band__cell doc-band__cell--number">
            <span>رقم الكشف</span>
            <strong>{statement.statementNumber}</strong>
          </div>
          <div className="doc-band__title">
            <h1>{isSupplier ? "كشف حساب مورد" : "كشف حساب عميل"}</h1>
            <span>Statement</span>
          </div>
          <div className="doc-band__cell">
            <span>تاريخ الكشف</span>
            <strong>{statement.date}</strong>
          </div>
        </section>

        <section className="statement-page__info">
          <div className="statement-page__field">
            <span>اسم {partyWord}</span>
            <strong>{statement.customerName}</strong>
          </div>
          <div className="statement-page__field">
            <span>رقم {partyWord}</span>
            <strong>{statement.customerNumber || "—"}</strong>
          </div>
          <div className="statement-page__field">
            <span>رقم الجوال</span>
            <strong dir="ltr">{statement.phone || "—"}</strong>
          </div>
          <div className="statement-page__field">
            <span>العنوان</span>
            <strong>{statement.address || "—"}</strong>
          </div>
          <div className="statement-page__field">
            <span>نوع الحساب</span>
            <strong>{statement.accountType || "عميل"}</strong>
          </div>
          <div className="statement-page__field">
            <span>تاريخ فتح الحساب</span>
            <strong>{statement.accountOpeningDate || "—"}</strong>
          </div>
        </section>

        <div className="rep__period">
          <em>الفترة من</em>
          <strong>{statement.periodFrom || "—"}</strong>
          <em>إلى</em>
          <strong>{statement.periodTo || "—"}</strong>
          <em>· الرصيد الافتتاحي</em>
          <strong dir="ltr">{money(opening)} ر.ي</strong>
        </div>

        <section className="doc-table-wrap" style={{ marginTop: "4mm" }}>
          <table className="doc-table doc-table--report doc-table--compact">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>التاريخ</th>
                <th className="col-desc" style={{ width: "31%" }}>
                  البيان
                </th>
                <th style={{ width: "13%" }}>رقم المستند</th>
                <th style={{ width: "12%" }}>نوع المستند</th>
                <th style={{ width: "11%" }}>مدين</th>
                <th style={{ width: "11%" }}>دائن</th>
                <th style={{ width: "14%" }}>الرصيد المتراكم</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, running: lineBalance }) => (
                <tr key={entry.id}>
                  <td className="col-number">{entry.date}</td>
                  <td className="col-desc">{entry.description || entry.transactionType || "—"}</td>
                  <td className="col-number">{entry.documentNumber || "—"}</td>
                  <td style={{ textAlign: "center" }}>{entry.documentType}</td>
                  <td className="col-number">{entry.debit ? money(entry.debit) : "—"}</td>
                  <td className="col-number">{entry.credit ? money(entry.credit) : "—"}</td>
                  <td className="col-number">{money(lineBalance)}</td>
                </tr>
              ))}
              {!rows.length && (
                <>
                  <tr className="doc-table__empty" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", padding: "6mm", color: "var(--print-muted)" }}
                    >
                      لا توجد حركات خلال الفترة المحددة
                    </td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>الإجماليات</td>
                <td className="col-number">{money(totalDebit)}</td>
                <td className="col-number">{money(totalCredit)}</td>
                <td className="col-number">{money(closing)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <div className="rep__period" style={{ marginTop: "3mm" }}>
          <em>{closing >= 0 ? `المتبقي على ${partyWord}` : `المتبقي لهذا ${partyWord}`}</em>
          <strong dir="ltr">{money(Math.abs(closing))} ر.ي</strong>
        </div>

        <div className="rep__signs">
          <div className="doc-sign">
            <div className="doc-sign__title">إعداد</div>
            <div className="doc-sign__line" />
          </div>
          <div className="doc-sign">
            <div className="doc-sign__title">مراجعة</div>
            <div className="doc-sign__line" />
          </div>
          <div className="doc-sign">
            <div className="doc-sign__title">يعتمد</div>
            <div className="doc-sign__line" />
          </div>
        </div>

        <footer className="doc-foot">
          <span>
            {company.footerText || "هذا الكشف صادر من نظام معامل هاشم — لأي استفسار تواصل معنا."}
          </span>
          <span className="doc-foot__note">{statement.customerName}</span>
        </footer>
      </div>
    );
  },
);

CustomerStatement.displayName = "CustomerStatement";
