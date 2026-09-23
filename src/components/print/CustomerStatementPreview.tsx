import { useStore } from "@/lib/store";
import PrintPreview from "./PrintPreview";
import {
  CustomerStatement,
  type CustomerStatementData,
  type StatementCompany,
} from "./CustomerStatement";

/**
 * معاينة كشف الحساب والطباعة.
 *
 * كانت الطباعة هنا تفتح نافذة منبثقة بملف PDF (تُحجب في كثير من المتصفحات
 * فيفشل الأمر بلا سبب ظاهر). الآن تُستخدم نفس طبقة الطباعة الموحّدة:
 * معاينة بمقاس A4 ثم `window.print()` مباشرة.
 */
export function CustomerStatementPreview({
  statement,
  company,
  onClose,
}: {
  statement: CustomerStatementData;
  company: StatementCompany;
  /** يُغلق المعاينة ويعيد المستخدم إلى شاشة العملاء والموردين. */
  onClose: () => void;
}) {
  const footerText = useStore((s) => s.organization.footerText);

  return (
    <PrintPreview
      title="معاينة كشف الحساب قبل الطباعة"
      subtitle={`${statement.customerName} · ${statement.periodFrom} → ${statement.periodTo}`}
      paper="a4"
      fileName={`كشف_حساب_${statement.customerName}`}
      shareText={`كشف حساب ${statement.customerName} — ${company.name}`}
      onClose={onClose}
    >
      <CustomerStatement
        statement={statement}
        company={{ ...company, footerText: company.footerText || footerText }}
      />
    </PrintPreview>
  );
}

export default CustomerStatementPreview;
