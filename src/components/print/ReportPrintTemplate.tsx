import { useStore } from "@/lib/store";
import type { ReportDocumentData } from "@/domain/report-document";
import PrintPreview from "./PrintPreview";

interface Props {
  data: ReportDocumentData;
  onClose: () => void;
}

/**
 * تقرير A4 قابل للطباعة.
 *
 * كان زر الطباعة في شاشة التقارير يستدعي `window.print()` على **الشاشة نفسها**،
 * فيخرج التقرير محبوسًا وسط القائمة الجانبية والأزرار وأعمدة الواجهة. الآن يُبنى
 * مستند مستقل بنفس هوية المنشأة، يُعاين أولًا ثم يُطبع أو يُنزَّل PDF.
 */
export default function ReportPrintTemplate({ data, onClose }: Props) {
  const organization = useStore((s) => s.organization);
  const settings = useStore((s) => s.settings);
  const companyName = organization.name || settings.name;

  return (
    <PrintPreview
      title="معاينة التقرير قبل الطباعة"
      subtitle={data.title}
      paper="a4"
      fileName={`${data.title}_${data.periodFrom}_${data.periodTo}`}
      shareText={`${data.title} — ${companyName} (${data.periodFrom} → ${data.periodTo})`}
      onClose={onClose}
    >
      <div className="rep">
        <header className="doc-head">
          <div className="doc-head__copy">
            <h1 className="doc-head__name">{companyName}</h1>
            <div className="doc-head__meta">{organization.address || settings.location}</div>
            <div className="doc-head__phones">
              {organization.phone || [settings.phone1, settings.phone2].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="doc-head__logo">
            <img src={organization.logo || "/favicon.svg"} alt="شعار المنشأة" />
          </div>
        </header>

        <section className="doc-band">
          <div className="doc-band__cell doc-band__cell--number">
            <span>من تاريخ</span>
            <strong>{data.periodFrom}</strong>
          </div>
          <div className="doc-band__title">
            <h1>{data.title}</h1>
            <span>Report</span>
          </div>
          <div className="doc-band__cell">
            <span>إلى تاريخ</span>
            <strong>{data.periodTo}</strong>
          </div>
        </section>

        {data.subtitle || data.meta?.length ? (
          <div className="rep__period">
            {data.subtitle ? <strong>{data.subtitle}</strong> : null}
            {(data.meta || []).map((item) => (
              <span key={item.label}>
                <em>{item.label}: </em>
                <strong>{item.value}</strong>
              </span>
            ))}
            <span>
              <em>تاريخ الطباعة: </em>
              <strong dir="ltr">{new Date().toLocaleString("en-GB")}</strong>
            </span>
          </div>
        ) : null}

        {data.sections.map((section, index) => (
          <section className="rep__section" key={`${section.title}-${index}`}>
            <div className="rep__section-head">
              <h2>{section.title}</h2>
              {section.subtitle ? <p>{section.subtitle}</p> : null}
            </div>

            <div className="rep__section-body">
              {section.kpis?.length ? (
                <div
                  className="rep__kpis"
                  style={{
                    ["--rep-kpi-cols" as string]: String(
                      Math.min(4, Math.max(2, section.kpis.length)),
                    ),
                    padding: 0,
                  }}
                >
                  {section.kpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className={`rep__kpi${kpi.tone && kpi.tone !== "muted" ? ` rep__kpi--${kpi.tone}` : ""}`}
                    >
                      <span className="rep__kpi-label">{kpi.label}</span>
                      <span className="rep__kpi-value">{kpi.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.columns?.length ? (
                <div
                  className="doc-table-wrap"
                  style={{ margin: section.kpis?.length ? "3mm 0 0" : "0" }}
                >
                  <table className="doc-table doc-table--report doc-table--compact">
                    <thead>
                      <tr>
                        {section.columns.map((column) => (
                          <th
                            key={column.label}
                            style={{
                              width: column.width,
                              textAlign: column.align === "right" ? "right" : "center",
                            }}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows?.length ? (
                        section.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => {
                              const column = section.columns?.[cellIndex];
                              const isNumber = typeof cell === "number";
                              return (
                                <td
                                  key={cellIndex}
                                  className={
                                    isNumber
                                      ? "col-number"
                                      : column?.align === "right"
                                        ? "col-desc"
                                        : ""
                                  }
                                  style={
                                    isNumber
                                      ? undefined
                                      : {
                                          textAlign: column?.align === "right" ? "right" : "center",
                                        }
                                  }
                                >
                                  {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={section.columns.length}
                            style={{
                              textAlign: "center",
                              padding: "6mm",
                              color: "var(--print-muted)",
                            }}
                          >
                            {section.emptyText || "لا توجد بيانات في هذه الفترة"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {section.foot?.length ? (
                      <tfoot>
                        <tr>
                          {section.foot.map((cell, cellIndex) => (
                            <td key={cellIndex} className={cellIndex === 0 ? "" : "col-number"}>
                              {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              ) : null}

              {section.notes?.length ? (
                <div className="rep__notes">
                  {section.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ))}

        {data.footNotes?.length ? (
          <div className="rep__notes">
            {data.footNotes.map((note) => (
              <p key={note}>• {note}</p>
            ))}
          </div>
        ) : null}

        <div className="rep__signs">
          <div className="doc-sign">
            <div className="doc-sign__title">أمين الصندوق</div>
            <div className="doc-sign__line" />
          </div>
          <div className="doc-sign">
            <div className="doc-sign__title">المحاسب</div>
            <div className="doc-sign__line" />
          </div>
          <div className="doc-sign">
            <div className="doc-sign__title">الإدارة</div>
            <div className="doc-sign__line" />
          </div>
        </div>

        <footer className="doc-foot">
          <span>{organization.footerText || `تقرير صادر من نظام ${companyName}`}</span>
          <span className="doc-foot__note">
            {data.periodFrom} — {data.periodTo}
          </span>
        </footer>
      </div>
    </PrintPreview>
  );
}
