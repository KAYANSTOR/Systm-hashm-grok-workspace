import { createFileRoute } from "@tanstack/react-router";
import { 
  Building2, 
  Cloud, 
  Database, 
  Download, 
  Info, 
  MapPin, 
  Phone, 
  RotateCcw, 
  Save, 
  Store, 
  Upload, 
  Wifi, 
  ShieldCheck, Trash2 
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const org = useStore((s) => s.organization);
  const updateOrganization = useStore((s) => s.updateOrganization);
    const importData = useStore((s) => s.importData);
  const resetDatabase = useStore((s) => s.resetDatabase);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(settings);
  const [orgForm, setOrgForm] = useState(org);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

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
      setForm(useStore.getState().settings);
      toast.success("تم استعادة البيانات بنجاح");
    } catch {
      toast.error("تعذر قراءة الملف. تأكد من صحة ملف النسخة الاحتياطية.");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="page-title">الإعدادات</h1>
        <p className="page-subtitle">تخصيص النظام وإدارة بيانات المعمل.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* بيانات المعمل */}
        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Store className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-brand-dark">بيانات المعمل</h2>
              <p className="text-xs text-muted">تظهر هذه البيانات في الفواتير والسندات</p>
            </div>
          </div>
          
          <div className="flex flex-1 flex-col justify-between gap-4 p-5">
            <div className="grid gap-4">
              <label className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
                  <Building2 className="size-4" />
                </div>
                <input 
                  className="input-field pr-10" 
                  placeholder="اسم المعمل"
                  value={orgForm.name} 
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} 
                />
              </label>

              <label className="relative">
                <span className="block text-xs font-bold text-brand-dark mb-2">شعار المؤسسة</span>
                <div className="flex items-center gap-4">
                  {orgForm.logo ? (
                    <img src={orgForm.logo} className="size-16 rounded-xl object-contain border border-line bg-white p-1" alt="Logo" />
                  ) : (
                    <div className="size-16 rounded-xl bg-canvas border border-dashed border-line flex items-center justify-center text-muted">
                      <Store className="size-6 opacity-50" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-soft file:text-brand hover:file:bg-brand/20 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setOrgForm({ ...orgForm, logo: ev.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </label>

              <label className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
                  <MapPin className="size-4" />
                </div>
                <input 
                  className="input-field pr-10" 
                  placeholder="العنوان (مثال: صنعاء - شارع الزبيري)"
                  value={orgForm.address} 
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} 
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
                    <Phone className="size-4" />
                  </div>
                  <input 
                    className="input-field pr-10" 
                    dir="ltr" 
                    placeholder="رقم الهاتف 1"
                    value={orgForm.phone} 
                    onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} 
                  />
                </label>
                <label className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
                    <Phone className="size-4" />
                  </div>
                  <input 
                    className="input-field pr-10" 
                    dir="ltr" 
                    placeholder="رقم الهاتف 2"
                    value={orgForm.commercialNumber || ""} 
                    onChange={(e) => setOrgForm({ ...orgForm, commercialNumber: e.target.value })} 
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary mt-2 w-full py-3"
              onClick={() => {
                updateOrganization(orgForm);
                toast.success("تم تحديث بيانات المعمل وحفظها بنجاح");
              }}
            >
              <Save className="size-5" />
              حفظ التعديلات
            </button>
          </div>
        </section>

        {/* تفريغ قاعدة البيانات */}
        <section className="card overflow-hidden md:col-span-2 border-bad/30">
          <div className="flex items-center gap-3 border-b border-bad/20 bg-bad-soft/30 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-bad-soft text-bad">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-bad">منطقة الخطر (حذف البيانات)</h2>
              <p className="text-xs text-muted">حذف جميع البيانات من قاعدة البيانات وإعادة تصفير النظام</p>
            </div>
          </div>
          <div className="p-5">
            <button
              type="button"
              className="btn-primary w-full py-3 bg-bad hover:bg-bad/90 text-white"
              onClick={async () => {
                if (!confirm("تحذير نهائي: هل أنت متأكد من حذف جميع بيانات النظام (فواتير، عملاء، منتجات، سندات)؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
                const p = toast.loading("جاري مسح قاعدة البيانات...");
                try {
                  await resetDatabase();
                  toast.success("تم مسح قاعدة البيانات بنجاح", { id: p });
                } catch (e) {
                  toast.error("حدث خطأ أثناء مسح قاعدة البيانات", { id: p });
                }
              }}
            >
              <Trash2 className="size-5" />
              حذف جميع البيانات بالكامل
            </button>
          </div>
        </section>
    

        {/* المزامنة السحابية */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Cloud className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-brand-dark">التخزين والمزامنة</h2>
              <p className="text-xs text-muted">حالة الاتصال بقاعدة البيانات السحابية</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between rounded-2xl bg-canvas p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex size-12 items-center justify-center rounded-full ${isOnline ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'}`}>
                  {isOnline ? <Wifi className="size-6" /> : <Database className="size-6" />}
                </div>
                <div>
                  <h3 className="font-black">{isOnline ? "متصل ومزامن" : "وضع عدم الاتصال"}</h3>
                  <p className="text-xs text-muted">
                    {isOnline ? "يتم حفظ التغييرات فوراً في السحابة" : "يتم حفظ التغييرات محلياً وسيتم مزامنتها عند توفر الإنترنت"}
                  </p>
                </div>
              </div>
              {isOnline && <ShieldCheck className="size-6 text-good" />}
            </div>
            <div className="mt-4 rounded-xl border border-line bg-brand-soft/50 p-4">
              <p className="text-xs font-bold leading-relaxed text-brand-dark">
                يعمل النظام بتقنية Offline-First، مما يتيح لك الاستمرار في العمل وإصدار الفواتير حتى في حال انقطاع الإنترنت. يتم حفظ كل شيء بأمان.
              </p>
            </div>
          </div>
        </section>

        {/* النسخ الاحتياطي */}
        <section className="card overflow-hidden md:col-span-2">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-good-soft text-good">
              <Database className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-brand-dark">إدارة البيانات المحلية</h2>
              <p className="text-xs text-muted">استيراد وتصدير البيانات احتياطياً</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-line">
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-2 p-8 transition hover:bg-canvas"
              onClick={exportJson}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform group-hover:scale-110">
                <Download className="size-6" />
              </span>
              <p className="font-bold">تنزيل نسخة احتياطية</p>
              <p className="text-center text-xs text-muted">حفظ ملف JSON يحتوي على كافة بيانات النظام الحالية (فواتير، عملاء، مخزون)</p>
            </button>

            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-2 p-8 transition hover:bg-canvas"
              onClick={() => fileRef.current?.click()}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-good-soft text-good transition-transform group-hover:scale-110">
                <Upload className="size-6" />
              </span>
              <p className="font-bold">استعادة من ملف</p>
              <p className="text-center text-xs text-muted">رفع ملف JSON لاستعادة البيانات (تنبيه: سيتم استبدال البيانات الحالية)</p>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
          </div>
        </section>
        
        
      </div>

      <div className="flex flex-col items-center justify-center gap-2 pt-8 pb-4 text-muted">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Info className="size-4" />
          معمل هاشم · الإصدار 2.0 (متزامن سحابياً)
        </div>
        <p className="text-[10px] uppercase tracking-widest opacity-60">
          Developed securely with ❤️
        </p>
      </div>
    </div>
  );
}
