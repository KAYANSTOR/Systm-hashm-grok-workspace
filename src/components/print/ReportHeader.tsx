import { useStore } from "@/lib/store";

export function ReportHeader({ title, subtitle, documentNumber, date }: { title: string, subtitle?: string, documentNumber?: string, date?: string }) {
  const org = useStore(s => s.organization);

  return (
    <div className="flex justify-between items-start border-b-2 border-brand pb-6 mb-6">
      <div className="flex flex-col gap-1 max-w-[50%]">
        <h1 className="text-2xl font-black text-brand-dark">{org.name}</h1>
        {org.description && <p className="text-sm font-bold text-muted">{org.description}</p>}
        {org.address && <p className="text-xs text-muted mt-2">{org.address}</p>}
        {(org.phone || org.email) && (
          <p className="text-xs text-muted mt-1" dir="ltr">
            {org.phone} {org.phone && org.email && " | "} {org.email}
          </p>
        )}
        
      </div>

      <div className="flex flex-col items-center gap-4">
        {org.logo ? (
          <img src={org.logo} alt={org.name} className="h-16 object-contain" />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-brand-soft flex items-center justify-center">
            <span className="text-2xl font-black text-brand">{org.name.slice(0, 1)}</span>
          </div>
        )}
        <div className="text-center bg-canvas px-4 py-2 rounded-xl border border-line">
          <h2 className="text-xl font-black text-brand-dark leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted font-bold mt-1">{subtitle}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-[25%] text-left">
        {documentNumber && (
          <div>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">رقم المستند</p>
            <p className="font-black tabular-nums">{documentNumber}</p>
          </div>
        )}
        {date && (
          <div>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">التاريخ</p>
            <p className="font-bold text-sm tabular-nums">{date}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportFooter() {
  const org = useStore(s => s.organization);

  return (
    <div className="mt-12 pt-6 border-t border-line text-center text-[10px] text-muted flex flex-col gap-1 print:fixed print:bottom-0 print:left-0 print:w-full print:bg-white print:pb-4">
      <p className="font-bold text-brand-dark">{org.name}</p>
      {org.footerText ? (
        <p>{org.footerText}</p>
      ) : (
        <p>
          {org.address && <span>{org.address}</span>}
          {org.address && org.phone && <span> • </span>}
          {org.phone && <span dir="ltr">{org.phone}</span>}
          {org.website && <span> • {org.website}</span>}
        </p>
      )}
    </div>
  );
}
