import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Cloud,
  Database,
  Download,
  Info,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Store,
  Upload,
  Wifi,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { forceAllowFetch, syncErrorMessage, useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AccessControlCard } from "@/components/settings/access-control-card";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const user = useCurrentUser();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const org = useStore((s) => s.organization);
  const updateOrganization = useStore((s) => s.updateOrganization);
  const importData = useStore((s) => s.importData);
  const resetDatabase = useStore((s) => s.resetDatabase);
  const warehouses = useStore((s) => s.warehouses || []);
  const productCategories = useStore((s) => s.productCategories || []);
  const addWarehouse = useStore((s) => s.addWarehouse);
  const updateWarehouse = useStore((s) => s.updateWarehouse);
  const addProductCategory = useStore((s) => s.addProductCategory);
  const updateProductCategory = useStore((s) => s.updateProductCategory);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(settings);
  const [orgForm, setOrgForm] = useState(org);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [categoryName, setCategoryName] = useState("");
  // المزامنة اليدوية تستخدم drainPendingOutbox + fetchFromDb فقط (انظر syncNow)

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
      if (!Array.isArray(data.customers) || !Array.isArray(data.invoices))
        throw new Error("ملف غير صالح");
      importData(data);
      setForm(useStore.getState().settings);
      toast.success("تم استعادة البيانات بنجاح");
    } catch {
      toast.error("تعذر قراءة الملف. تأكد من صحة ملف النسخة الاحتياطية.");
    }
  };

  const syncNow = async () => {
    if (!isOnline) {
      toast.error("لا يمكن المزامنة قبل عودة الإنترنت");
      return;
    }
    setIsSyncing(true);
    try {
      // مزامنة آمنة: ترحيل طابور العمليات فقط (Outbox) ثم جلب الحالة من الخادم.
      // ممنوع استدعاء syncLegacyDb هنا — كان يعيد إدراج القيود المالية ويضاعف ذمم العملاء.
      await useStore.getState().drainPendingOutbox();
      forceAllowFetch();
      await useStore.getState().fetchFromDb();
      const pending = useStore.getState().pendingSyncCount;
      if (pending > 0) {
        toast.error(`تبقّى ${pending} عملية بانتظار الترحيل. راجع الاتصال أو الصلاحيات.`);
      } else {
        toast.success("تمت مزامنة العمليات وتحديث البيانات من السحابة");
      }
    } catch (error) {
      toast.error(`${syncErrorMessage(error)} ستبقى البيانات محفوظة على هذا الجهاز.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const createWarehouse = () => {
    if (!warehouseName.trim()) return toast.error("أدخل اسم المخزن");
    addWarehouse({ name: warehouseName, location: warehouseLocation });
    setWarehouseName("");
    setWarehouseLocation("");
    toast.success("تمت إضافة المخزن");
  };

  const createCategory = () => {
    if (!categoryName.trim()) return toast.error("أدخل اسم الفئة");
    addProductCategory(categoryName);
    setCategoryName("");
    toast.success("تمت إضافة الفئة");
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="page-title">الإعدادات</h1>
        <p className="page-subtitle">تخصيص النظام وإدارة بيانات المعمل.</p>
      </div>

      <AccessControlCard />

      <div className="grid gap-6 md:grid-cols-2">
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
                <span className="mb-2 block text-xs font-bold text-brand-dark">شعار المؤسسة</span>
                <div className="flex items-center gap-4">
                  {orgForm.logo ? (
                    <img
                      src={orgForm.logo}
                      className="size-16 rounded-xl border border-line bg-white p-1 object-contain"
                      alt="Logo"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-line bg-canvas text-muted">
                      <Store className="size-6 opacity-50" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="cursor-pointer text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-xs file:font-bold file:text-brand hover:file:bg-brand/20"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setOrgForm({ ...orgForm, logo: ev.target?.result as string });
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

        <section className="card overflow-hidden md:col-span-2 border-bad/30">
          <div className="flex items-center gap-3 border-b border-bad/20 bg-bad-soft/30 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-bad-soft text-bad">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-bad">منطقة الخطر (حذف البيانات)</h2>
              <p className="text-xs text-muted">
                حذف جميع البيانات من قاعدة البيانات وإعادة تصفير النظام
              </p>
            </div>
          </div>
          <div className="p-5">
            <button
              type="button"
              className="btn-primary w-full bg-bad py-3 text-white hover:bg-bad/90"
              onClick={async () => {
                if (
                  !confirm(
                    "تحذير نهائي: هل أنت متأكد من حذف جميع بيانات النظام (فواتير، عملاء، منتجات، سندات)؟ هذا الإجراء لا يمكن التراجع عنه.",
                  )
                )
                  return;
                const p = toast.loading("جاري مسح قاعدة البيانات...");
                try {
                  await resetDatabase();
                  toast.success("تم مسح قاعدة البيانات بنجاح", { id: p });
                } catch {
                  toast.error("حدث خطأ أثناء مسح قاعدة البيانات", { id: p });
                }
              }}
            >
              <Trash2 className="size-5" />
              حذف جميع البيانات بالكامل
            </button>
          </div>
        </section>

        <section className="card overflow-hidden md:col-span-2">
          <div className="border-b border-line bg-canvas/50 px-5 py-4">
            <h2 className="font-black text-brand-dark">إدارة المخازن والفئات</h2>
            <p className="text-xs text-muted">
              تُستخدم هذه القوائم مباشرة في المخزون والتقارير وأوامر التوريد والصرف.
            </p>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-black">المخازن</h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="input-field"
                  placeholder="اسم المخزن"
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="الموقع (اختياري)"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                />
                <button type="button" className="btn-primary" onClick={createWarehouse}>
                  إضافة
                </button>
              </div>
              <div className="divide-y divide-line rounded-2xl border border-line">
                {warehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div>
                      <p className="font-bold">{warehouse.name}</p>
                      <p className="text-xs text-muted">{warehouse.location || "بدون موقع"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => {
                          const name = window.prompt("اسم المخزن", warehouse.name);
                          if (name?.trim()) updateWarehouse(warehouse.id, { name: name.trim() });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() =>
                          updateWarehouse(warehouse.id, { isActive: !warehouse.isActive })
                        }
                      >
                        {warehouse.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-black">فئات المنتجات</h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="input-field"
                  placeholder="اسم الفئة"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
                <button type="button" className="btn-primary" onClick={createCategory}>
                  إضافة
                </button>
              </div>
              <div className="divide-y divide-line rounded-2xl border border-line">
                {productCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <p
                      className={`font-bold ${category.isActive ? "" : "text-muted line-through"}`}
                    >
                      {category.name}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => {
                          const name = window.prompt("اسم الفئة", category.name);
                          if (name?.trim())
                            updateProductCategory(category.id, { name: name.trim() });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() =>
                          updateProductCategory(category.id, { isActive: !category.isActive })
                        }
                      >
                        {category.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-black text-brand-dark">الحساب</h2>
              <p className="text-xs text-muted">يبقى تسجيل الدخول محفوظًا حتى تختار تسجيل الخروج</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="font-bold">{user?.displayName || "المستخدم الحالي"}</p>
              <p className="text-xs text-muted">الحساب متصل بهذا الجهاز</p>
            </div>
            <button
              type="button"
              className="btn-ghost text-bad"
              onClick={() => {
                void signOut("/").catch((error) =>
                  toast.error(error instanceof Error ? error.message : "تعذر تسجيل الخروج"),
                );
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </section>

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
                <div
                  className={`flex size-12 items-center justify-center rounded-full ${isOnline ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}
                >
                  {isOnline ? <Wifi className="size-6" /> : <Database className="size-6" />}
                </div>
                <div>
                  <h3 className="font-black">{isOnline ? "متصل ومزامن" : "وضع عدم الاتصال"}</h3>
                  <p className="text-xs text-muted">
                    {isOnline
                      ? "يتم حفظ التغييرات فوراً في السحابة"
                      : "يتم حفظ التغييرات محلياً وسيتم مزامنتها عند توفر الإنترنت"}
                  </p>
                </div>
              </div>
              {isOnline && <ShieldCheck className="size-6 text-good" />}
            </div>
            <div className="mt-4 rounded-xl border border-line bg-brand-soft/50 p-4">
              <p className="text-xs font-bold leading-relaxed text-brand-dark">
                يعمل النظام بتقنية Offline-First، مما يتيح لك الاستمرار في العمل وإصدار الفواتير حتى
                في حال انقطاع الإنترنت. يتم حفظ كل شيء بأمان.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary mt-4 w-full py-3"
              disabled={!isOnline || isSyncing}
              onClick={() => void syncNow()}
            >
              <RefreshCw className={`size-5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "جارٍ رفع وتحديث البيانات…" : "مزامنة بيانات هذا الجهاز الآن"}
            </button>
          </div>
        </section>

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
          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-2 p-8 transition hover:bg-canvas"
              onClick={exportJson}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform group-hover:scale-110">
                <Download className="size-6" />
              </span>
              <p className="font-bold">تنزيل نسخة احتياطية</p>
              <p className="text-center text-xs text-muted">
                حفظ ملف JSON يحتوي على كافة بيانات النظام الحالية (فواتير، عملاء، مخزون)
              </p>
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
              <p className="text-center text-xs text-muted">
                رفع ملف JSON لاستعادة البيانات (تنبيه: سيتم استبدال البيانات الحالية)
              </p>
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

      <div className="flex flex-col items-center justify-center gap-2 pb-4 pt-8 text-muted">
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
