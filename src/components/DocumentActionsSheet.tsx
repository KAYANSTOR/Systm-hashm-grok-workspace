import { Download, MessageCircle, Printer, X } from "lucide-react";

export interface DocumentActionsSheetProps {
  open: boolean;
  title: string;
  phone?: string;
  onPrint: () => void;
  onDownload?: () => void;
  onClose: () => void;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `967${digits.slice(1)}`;
  return digits.replace(/^\+/, "");
}

export function openWhatsApp(phone: string | undefined, message: string) {
  if (!phone?.trim()) {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    return;
  }
  const normalized = normalizePhone(phone);
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

export default function DocumentActionsSheet({
  open,
  title,
  phone,
  onPrint,
  onDownload,
  onClose,
}: DocumentActionsSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end bg-slate-950/45" role="dialog" aria-modal="true" aria-label={`إجراءات ${title}`}>
      <div className="w-full rounded-t-[28px] border-t border-line bg-paper p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">تم اعتماد {title}</h2>
            <p className="mt-1 text-sm text-muted">اختر الإجراء المطلوب للمستند</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <button type="button" className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-brand-soft px-3 py-3 font-bold text-brand" onClick={onPrint}>
            <Printer className="size-6" />
            طباعة
          </button>
          <button
            type="button"
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 font-bold text-emerald-700"
            onClick={() => openWhatsApp(phone, `${title} جاهز للمراجعة. شكرًا لتعاملكم معنا.`)}
          >
            <MessageCircle className="size-6" />
            واتساب
          </button>
          {onDownload ? (
            <button type="button" className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-blue-50 px-3 py-3 font-bold text-blue-700" onClick={onDownload}>
              <Download className="size-6" />
              تنزيل PDF
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-center text-xs text-muted">يفتح واتساب المحادثة والرسالة الجاهزة؛ اضغط إرسال من واتساب لإتمام الإرسال.</p>
      </div>
    </div>
  );
}
