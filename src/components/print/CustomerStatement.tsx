import React, { forwardRef } from "react";
import "./CustomerStatement.css";

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
};

interface Props {
  statement: CustomerStatementData;
  company: StatementCompany;
  className?: string;
}

const money = (value = 0) =>
  new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );

const sum = (entries: StatementEntry[], field: "debit" | "credit") =>
  entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);

export const CustomerStatement = forwardRef<HTMLDivElement, Props>(
  ({ statement, company, className = "" }, ref) => {
    const totalDebit = sum(statement.entries, "debit");
    const totalCredit = sum(statement.entries, "credit");
    const remaining = totalDebit - totalCredit + (statement.openingBalance || 0);
    const remainingLabel = remaining >= 0 ? "المتبقي عليه" : "المتبقي له";

    return (
      <div ref={ref} className={`customer-statement ${className}`}>
        <header className="statement-header">
          <div className="statement-brand">
            <div className="statement-company-name">{company.name}</div>
            <div className="statement-location">{company.location}</div>
            <div className="statement-phone">
              {company.phone1} - {company.phone2}
            </div>
          </div>
          <div className="statement-logo">
            {company.logoSrc ? (
              <img src={company.logoSrc} className="w-full h-auto object-contain max-h-24" alt="الشعار" />
            ) : (
              <div className="logo-fallback">
                <strong>هاشم</strong>
                <span>للتطوير الالكتروني</span>
              </div>
            )}
          </div>
        </header>

        <section className="statement-title-row">
          <div className="statement-meta-box">
            <span>رقم الكشف</span>
            <strong>{statement.statementNumber}</strong>
          </div>
          <div className="statement-title">
            <span>《</span>
            <h1>كشف حساب العملاء</h1>
            <span>》</span>
          </div>
          <div className="statement-meta-box">
            <span>التاريخ</span>
            <strong>{statement.date}</strong>
          </div>
        </section>

        <section className="customer-info">
          <div className="info-column">
            <InfoRow label="اسم العميل" value={statement.customerName} />
            <InfoRow label="نوع الحساب" value={statement.accountType || "عميل"} />
            <InfoRow label="تاريخ فتح الحساب" value={statement.accountOpeningDate || "—"} />
          </div>
          <div className="info-column">
            <InfoRow label="رقم العميل" value={statement.customerNumber} />
            <InfoRow label="رقم الجوال" value={statement.phone || "—"} />
            <InfoRow label="العنوان" value={statement.address || "—"} />
          </div>
        </section>

        <div className="statement-period">
          الفترة من <strong>{statement.periodFrom}</strong> إلى{" "}
          <strong>{statement.periodTo}</strong>
        </div>

        <table className="statement-table">
          <thead>
            <tr>
              <th className="date-col">التاريخ</th>
              <th className="type-col">نوع العملية</th>
              <th className="doc-col">رقم المستند</th>
              <th className="description-col">البيان</th>
              <th className="debit-col">مدين</th>
              <th className="credit-col">دائن</th>
              <th className="doc-type-col">نوع المستند</th>
            </tr>
          </thead>
          <tbody>
            {statement.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.transactionType}</td>
                <td className="ltr">{entry.documentNumber || "—"}</td>
                <td className="description">{entry.description}</td>
                <td className="amount debit">{entry.debit ? money(entry.debit) : "—"}</td>
                <td className="amount credit">{entry.credit ? money(entry.credit) : "—"}</td>
                <td>{entry.documentType}</td>
              </tr>
            ))}
            {!statement.entries.length && (
              <tr className="empty-ledger-row">
                <td colSpan={7}>لا توجد حركات خلال الفترة المحددة</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan={4} className="totals-title">الإجماليات</td>
              <td className="amount debit">{money(totalDebit)}</td>
              <td className="amount credit">{money(totalCredit)}</td>
              <td className={`remaining ${remaining >= 0 ? "debit-balance" : "credit-balance"}`}>
                {money(Math.abs(remaining))}
                <small>{remainingLabel}</small>
              </td>
            </tr>
          </tfoot>
        </table>

        <footer className="statement-footer">
          <Signature label="إعداد" />
          <Signature label="راجعة" />
          <Signature label="يعتمد" />
        </footer>
      </div>
    );
  }
);

CustomerStatement.displayName = "CustomerStatement";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="signature">
      <strong>{label}</strong>
      <span />
    </div>
  );
}
