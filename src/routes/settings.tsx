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
  AlertTriangle,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { forceAllowFetch, syncErrorMessage, useStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AccessControlCard } from "@/components/settings/access-control-card";
import { ensureMyAccountIsAdmin } from "@/server/employees";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const RESET_PHRASE = "حذف الكل";

function SettingsPage() {
  const user = useCurrentUser();
  const settings = useStore((s) => s.settings);
  const org = useStore((s) => s.organization);
  const canManageRoles = useStore((s) => (s.userPermissions || []).includes("roles.manage"));
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

  const [orgForm, setOrgForm] = useState(org);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  useEffect(() => {
    setOrgForm(org);
  }, [org]);

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
      if (!Array.isArray(data.customers) || !Array.isArray(data.invoices)) throw new Error("ملف غير صالح");
      importData(data);
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

  const runResetDatabase = async () => {
    if (resetConfirmText.trim() !== RESET_PHRASE) {
      toast.error(`اكتب عبارة التأكيد بالضبط: ${RESET_PHRASE}`);
      return;
    }
    if (!window.confirm("تأكيد أخير: سيتم حذف الفواتير والعملاء والمنتجات والقيود من قاعدة البيانات. المتابعة؟")) {
      return;
    }
    setIsResetting(true);
    const loadingId = toast.loading("جاري تصفية قاعدة البيانات على الخادم والجهاز…");
    try {
      await resetDatabase();
      setShowResetConfirm(false);
      setResetConfirmText("");
      toast.success("تم حذف وتصفية بيانات العمل بنجاح", { id: loadingId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "حدث خطأ أثناء مسح قاعدة البيانات";
      if (/Forbidden|permission|db\.reset|settings\.write/i.test(msg)) {
        toast.error("لا تملك صلاحية تصفية قاعدة البيانات. سجّل الدخول كمدير.", { id: loadingId });
      } else if (/Unauthorized/i.test(msg)) {
        toast.error("انتهت الجلسة. سجّل الدخول ثم أعد المحاولة.", { id: loadingId });
      } else {
        toast.error(msg, { id: loadingId });
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 pb-10 sm:space-y-6 sm:px-0">
      <div>
        <h1 className="page-title text-xl sm:text-2xl">الإعدادات</h1>
        <p className="page-subtitle text-sm">تخصيص النظام وإدارة بيانات المعمل — متوافق مع الهاتف والكمبيوتر.</p>
      </div>

      <AccessControlCard />

      {/* شبكة متجاوبة: عمود واحد على الهاتف، عمودان على الشاشات الأوسع */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* بيانات المعمل */}
        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Store className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-brand-dark">بيانات المعمل</h2>
              <p className="text-xs text-muted">تظهر في الفواتير والسندات</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:gap-4">
              <label className="relative block">
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
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-brand-dark">شعار المؤسسة</span>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {orgForm.logo ? (
                    <img src={orgForm.logo} className="size-14 rounded-xl border border-line bg-white p-1 object-contain sm:size-16" alt="Logo" />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-xl border border-dashed border-line bg-canvas text-muted sm:size-16">
                      <Store className="size-6 opacity-50" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="max-w-full cursor-pointer text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-xs file:font-bold file:text-brand hover:file:bg-brand/20 sm:text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setOrgForm({ ...orgForm, logo: ev.target?.result as string });
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </label>
              <label className="relative block">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
                  <MapPin className="size-4" />
                </div>
                <input
                  className="input-field pr-10"
                  placeholder="العنوان"
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="relative block">
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
                <label className="relative block">
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
              className="btn-primary mt-1 w-full py-3"
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

        {/* الحساب + المزامنة جنبًا إلى جنب على الشاشات الكبيرة */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-brand-dark">الحساب</h2>
                <p className="text-xs text-muted">الجلسة تبقى محفوظة على هذا الجهاز (حتى سنة) إلا عند تسجيل الخروج أو إيقاف الحساب</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-bold">{user?.displayName || "المستخدم الحالي"}</p>
                  <p className="text-xs text-muted">الحساب متصل بهذا الجهاز</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 text-bad"
                  onClick={() => {
                    void signOut("/").catch((error) =>
                      toast.error(error instanceof Error ? error.message : "تعذر تسجيل الخروج"),
                    );
                  }}
                >
                  تسجيل الخروج
                </button>
              </div>
              {canManageRoles ? (
                <div className="rounded-xl border border-good/30 bg-good-soft px-3 py-2 text-center text-xs font-bold text-good">
                  <ShieldCheck className="mx-auto mb-1 size-4" />
                  تم تفعيل مدير النظام وحفظ الصلاحيات
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => {
                    void (async () => {
                      try {
                        const res = await ensureMyAccountIsAdmin();
                        forceAllowFetch();
                        await useStore.getState().fetchFromDb();
                        toast.success(
                          `تم تفعيل حسابك كمدير النظام وحفظه (${(res as any)?.permissionCount ?? "—"} صلاحية)`,
                        );
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "تعذر تفعيل المدير");
                      }
                    })();
                  }}
                >
                  <ShieldCheck className="size-4" />
                  تفعيل حسابي كمدير النظام مرة واحدة
                </button>
              )}
              <button
                type="button"
                className="btn-ghost w-full text-xs"
                onClick={() => {
                  useStore.getState().clearStuckOutbox?.();
                  toast.success("تم تنظيف الطابور العالق إن وُجد");
                }}
              >
                تنظيف عمليات المزامنة العالقة
              </button>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Cloud className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-brand-dark">التخزين والمزامنة</h2>
                <p className="text-xs text-muted">مزامنة الطابور مع Supabase</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full sm:size-12 ${
                      isOnline ? "bg-good/10 text-good" : "bg-bad/10 text-bad"
                    }`}
                  >
                    {isOnline ? <Wifi className="size-5 sm:size-6" /> : <Database className="size-5 sm:size-6" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black">{isOnline ? "متصل ومزامن" : "وضع عدم الاتصال"}</h3>
                    <p className="text-xs text-muted">
                      {isOnline
                        ? "التغييرات تُرحَّل عبر طابور العمليات"
                        : "العمليات تُحفظ محليًا حتى عودة الإنترنت"}
                    </p>
                  </div>
                </div>
                {isOnline && <ShieldCheck className="size-5 shrink-0 text-good sm:size-6" />}
              </div>
              <button
                type="button"
                className="btn-primary mt-4 w-full py-3"
                disabled={!isOnline || isSyncing}
                onClick={() => void syncNow()}
              >
                <RefreshCw className={`size-5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "جارٍ المزامنة…" : "مزامنة الآن"}
              </button>
            </div>
          </section>
        </div>

        {/* المخازن والفئات — كامل العرض */}
        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="font-black text-brand-dark">إدارة المخازن والفئات</h2>
            <p className="text-xs text-muted">تُستخدم في المخزون والتقارير وأوامر التوريد والصرف.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 p-4 sm:p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-black">المخازن</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
                <button type="button" className="btn-primary w-full sm:w-auto" onClick={createWarehouse}>
                  إضافة
                </button>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {warehouses.map((warehouse) => (
                  <div key={warehouse.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">{warehouse.name}</p>
                      <p className="text-xs text-muted">{warehouse.location || "بدون موقع"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                        onClick={() => updateWarehouse(warehouse.id, { isActive: !warehouse.isActive })}
                      >
                        {warehouse.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
                {!warehouses.length && <div className="p-4 text-center text-xs text-muted">لا توجد مخازن بعد</div>}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-black">فئات المنتجات</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="input-field"
                  placeholder="اسم الفئة"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
                <button type="button" className="btn-primary w-full sm:w-auto" onClick={createCategory}>
                  إضافة
                </button>
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {productCategories.map((category) => (
                  <div key={category.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className={`font-bold ${category.isActive ? "" : "text-muted line-through"}`}>{category.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => {
                          const name = window.prompt("اسم الفئة", category.name);
                          if (name?.trim()) updateProductCategory(category.id, { name: name.trim() });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => updateProductCategory(category.id, { isActive: !category.isActive })}
                      >
                        {category.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
                {!productCategories.length && <div className="p-4 text-center text-xs text-muted">لا توجد فئات بعد</div>}
              </div>
            </div>
          </div>
        </section>

        {/* نسخ احتياطي */}
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-good-soft text-good">
              <Database className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-brand-dark">إدارة البيانات المحلية</h2>
              <p className="text-xs text-muted">استيراد وتصدير نسخة احتياطية</p>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
            <button type="button" className="group flex flex-col items-center justify-center gap-2 p-6 transition hover:bg-canvas sm:p-8" onClick={exportJson}>
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform group-hover:scale-110 sm:size-14">
                <Download className="size-5 sm:size-6" />
              </span>
              <p className="font-bold">تنزيل نسخة احتياطية</p>
              <p className="px-2 text-center text-xs text-muted">ملف JSON بكل بيانات العمل الحالية</p>
            </button>
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-2 p-6 transition hover:bg-canvas sm:p-8"
              onClick={() => fileRef.current?.click()}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-good-soft text-good transition-transform group-hover:scale-110 sm:size-14">
                <Upload className="size-5 sm:size-6" />
              </span>
              <p className="font-bold">استعادة من ملف</p>
              <p className="px-2 text-center text-xs text-muted">يرفع ملف JSON (يستبدل البيانات المحلية الحالية)</p>
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

        {/* منطقة الخطر — تصفية قاعدة البيانات */}
        <section className="card overflow-hidden border-bad/30 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-bad/20 bg-bad-soft/30 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bad-soft text-bad">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-bad">منطقة الخطر — حذف وتصفية البيانات</h2>
              <p className="text-xs text-muted">
                يحذف من الخادم والجهاز: الفواتير، العملاء، الموردين، المنتجات، القيود، المخزون، والطابور. لا يحذف
                حسابات الدخول ولا الأدوار ولا الموظفين.
              </p>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {!showResetConfirm ? (
              <button
                type="button"
                className="btn-primary w-full bg-bad py-3 text-white hover:bg-bad/90"
                onClick={() => {
                  setShowResetConfirm(true);
                  setResetConfirmText("");
                }}
              >
                <Trash2 className="size-5" />
                بدء حذف وتصفية قاعدة البيانات
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-bad/30 bg-bad-soft/20 p-4">
                <div className="flex items-start gap-2 text-sm text-bad">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <p>
                    اكتب عبارة التأكيد <strong className="font-black">«{RESET_PHRASE}»</strong> ثم اضغط التأكيد.
                    هذا الإجراء لا يمكن التراجع عنه.
                  </p>
                </div>
                <input
                  className="input-field border-bad/40"
                  placeholder={RESET_PHRASE}
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  dir="rtl"
                  autoComplete="off"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={isResetting || resetConfirmText.trim() !== RESET_PHRASE}
                    className="btn-primary w-full bg-bad py-3 text-white hover:bg-bad/90 disabled:opacity-50 sm:flex-1"
                    onClick={() => void runResetDatabase()}
                  >
                    {isResetting ? "جارٍ التصفية…" : "تأكيد الحذف والتصفية الآن"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost w-full sm:w-auto"
                    disabled={isResetting}
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetConfirmText("");
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 pb-4 pt-6 text-muted">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Info className="size-4" />
          معمل هاشم · الإصدار 2.0 (متزامن سحابياً)
        </div>
        <p className="text-[10px] uppercase tracking-widest opacity-60">Supabase · Offline-first</p>
      </div>
    </div>
  );
}
