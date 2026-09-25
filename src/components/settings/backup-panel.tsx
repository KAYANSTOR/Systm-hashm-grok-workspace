import { useRef } from "react";
import { Download, HardDrive, Upload } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { Alert, SectionCard } from "@/components/ui/kit";

/**
 * إدارة البيانات المحلية — تصدير نسخة JSON كاملة واستعادتها.
 * نُقلت هنا بلا تغيير في بنية الملف أو في أسماء الحقول، حتى تظل النسخ القديمة
 * قابلة للاستعادة كما هي.
 */
export function BackupPanel() {
  const importData = useStore((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const data = useStore.getState();
    const payload: AppData = {
      customers: data.customers,
      suppliers: data.suppliers,
      inventory: data.inventory,
      invoices: data.invoices,
      vouchers: data.vouchers,
      transactions: data.transactions,
      expenses: data.expenses,
      settings: data.settings,
      organization: data.organization,
      warehouses: data.warehouses,
      productCategories: data.productCategories,
      auditLog: data.auditLog,
      warehouseStocks: data.warehouseStocks,
      userPermissions: data.userPermissions,
      userId: data.userId,
      defaultWarehouseId: data.defaultWarehouseId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hashem-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل النسخة الاحتياطية بنجاح");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppData;
      if (!Array.isArray(data.customers) || !Array.isArray(data.invoices)) {
        throw new Error("ملف غير صالح");
      }
      importData(data);
      toast.success("تم استعادة البيانات بنجاح");
    } catch {
      toast.error("تعذر قراءة الملف. تأكد من صحة ملف النسخة الاحتياطية.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionCard
        title="إدارة البيانات المحلية"
        subtitle="نسخة JSON كاملة من بيانات هذا الجهاز"
        icon={HardDrive}
        tone="good"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="group flex min-h-11 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-paper p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft"
            onClick={exportJson}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-transform group-hover:scale-110">
              <Download className="size-6" />
            </span>
            <span className="font-black text-ink">تنزيل نسخة احتياطية</span>
            <span className="text-center text-[11px] font-bold text-muted">
              ملف JSON بكل بيانات العمل الحالية
            </span>
          </button>

          <button
            type="button"
            className="group flex min-h-11 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-paper p-6 transition hover:-translate-y-0.5 hover:border-good/40 hover:shadow-soft"
            onClick={() => fileRef.current?.click()}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-good-soft text-good transition-transform group-hover:scale-110">
              <Upload className="size-6" />
            </span>
            <span className="font-black text-ink">استعادة من ملف</span>
            <span className="text-center text-[11px] font-bold text-muted">
              يستبدل بيانات هذا الجهاز بالملف المختار
            </span>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
              event.target.value = "";
            }}
          />
        </div>

        <Alert tone="warn" icon={HardDrive} title="قبل أي استعادة">
          الاستعادة تستبدل كل بيانات هذا الجهاز (الفواتير، السندات، المخزون، القيود). خُذ نسخة
          احتياطية أولًا، وتأكد أن الجهاز متصل بالإنترنت حتى تُرحَّل النتيجة إلى السحابة.
        </Alert>
      </SectionCard>

      <SectionCard title="ما الذي لا تدخله النسخة الاحتياطية؟" icon={HardDrive} tone="brand">
        <ul className="list-disc space-y-1.5 pr-5 text-xs font-bold leading-6 text-muted">
          <li>حسابات الدخول وكلمات المرور — لا تُصدَّر إطلاقًا لأسباب أمنية.</li>
          <li>الأدوار والصلاحيات المحفوظة على الخادم — تُدار من قسم «الحساب والوصول».</li>
          <li>سجل التدقيق على الخادم — يبقى مرجعًا رسميًا ولا يُستبدل بنسخة جهاز.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
