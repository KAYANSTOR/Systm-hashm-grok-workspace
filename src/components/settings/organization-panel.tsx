import { useEffect, useMemo, useState } from "react";
import { Building2, Globe, Mail, MapPin, Phone, Receipt, Save, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Alert, Chip, SectionCard } from "@/components/ui/kit";
import { FormGrid, TextField } from "@/components/ui/form";

/**
 * بيانات المعمل — المصدر الذي تُطبع منه ترويسة الفواتير والسندات والتقارير.
 * أُضيفت الحقول التي كانت موجودة في النموذج ومستخدمة في القوالب لكن بلا واجهة
 * (البريد، الموقع، الرقم الضريبي، السجل التجاري، نص التذييل)، وصار لكل حقل
 * تسمية صحيحة: `commercialNumber` كان يُعرض سابقًا كـ«رقم هاتف 2» وهو في الحقيقة
 * السجل التجاري، ويظهر في الفاتورة بجانب الرقم الضريبي.
 */
export function OrganizationPanel() {
  const org = useStore((s) => s.organization);
  const updateOrganization = useStore((s) => s.updateOrganization);

  const [orgForm, setOrgForm] = useState(org);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    setOrgForm(org);
  }, [org]);

  const isDirty = useMemo(
    () => JSON.stringify(orgForm) !== JSON.stringify(org),
    [orgForm, org],
  );

  const setLogo = (logo?: string) => setOrgForm((current) => ({ ...current, logo }));

  return (
    <SectionCard
      title="بيانات المعمل"
      subtitle="تظهر في ترويسة الفواتير والسندات والتقارير المطبوعة"
      icon={Store}
      tone="brand"
      action={isDirty ? <Chip tone="warn">تغييرات غير محفوظة</Chip> : <Chip tone="good">محفوظ</Chip>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line/70 bg-canvas/40 p-3.5">
          {orgForm.logo ? (
            <img
              src={orgForm.logo}
              className="size-16 shrink-0 rounded-2xl border border-line bg-white p-1 object-contain"
              alt="شعار المعمل"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-line bg-paper text-muted">
              <Store className="size-6 opacity-50" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-ink">شعار المؤسسة</p>
            <p className="mt-0.5 text-[11px] font-bold text-muted">
              صورة مربعة بمقاس صغير (PNG أو JPG) — تُطبع في رأس المستندات.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="btn-secondary min-h-11 cursor-pointer text-xs sm:min-h-0">
                {logoBusy ? "جارٍ التحميل…" : "اختيار صورة"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setLogoBusy(true);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setLogo(ev.target?.result as string);
                      setLogoBusy(false);
                    };
                    reader.onerror = () => setLogoBusy(false);
                    reader.readAsDataURL(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {orgForm.logo ? (
                <button type="button" className="btn-ghost text-xs text-bad" onClick={() => setLogo(undefined)}>
                  <Trash2 className="size-3.5" />
                  إزالة الشعار
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <FormGrid cols={2}>
          <TextField
            label="اسم المعمل"
            icon={Building2}
            placeholder="مثال: معمل هاشم للتصميم والتطريز"
            value={orgForm.name || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            label="العنوان"
            icon={MapPin}
            placeholder="المدينة — الشارع"
            value={orgForm.address || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, address: event.target.value }))}
          />
          <TextField
            label="رقم الهاتف"
            icon={Phone}
            dir="ltr"
            placeholder="7xxxxxxxx"
            value={orgForm.phone || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <TextField
            label="البريد الإلكتروني"
            icon={Mail}
            dir="ltr"
            placeholder="name@example.com"
            value={orgForm.email || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, email: event.target.value }))}
          />
          <TextField
            label="الموقع الإلكتروني"
            icon={Globe}
            dir="ltr"
            placeholder="example.com"
            value={orgForm.website || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, website: event.target.value }))}
          />
          <TextField
            label="السجل التجاري"
            icon={Receipt}
            dir="ltr"
            value={orgForm.commercialNumber || ""}
            onChange={(event) =>
              setOrgForm((current) => ({ ...current, commercialNumber: event.target.value }))
            }
          />
          <TextField
            label="الرقم الضريبي"
            icon={Receipt}
            dir="ltr"
            value={orgForm.taxNumber || ""}
            onChange={(event) => setOrgForm((current) => ({ ...current, taxNumber: event.target.value }))}
          />
          <TextField
            label="نص التذييل"
            icon={Receipt}
            placeholder="يظهر أسفل الفاتورة وكشف الحساب"
            value={orgForm.footerText || ""}
            onChange={(event) =>
              setOrgForm((current) => ({ ...current, footerText: event.target.value }))
            }
          />
        </FormGrid>

        <Alert tone="brand" icon={Building2} title="أين تظهر هذه البيانات؟">
          يُبنى رأس الفاتورة والسند والتقرير من هذه القيم مباشرةً، لذا أي تعديل يُحفظ هنا ينعكس على
          المطبوعات القادمة فورًا.
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-ghost w-full sm:w-auto"
            disabled={!isDirty}
            onClick={() => setOrgForm(org)}
          >
            إلغاء التغييرات
          </button>
          <button
            type="button"
            className="btn-primary w-full py-3 sm:w-auto sm:px-8"
            disabled={!isDirty}
            onClick={() => {
              updateOrganization(orgForm);
              toast.success("تم تحديث بيانات المعمل وحفظها بنجاح");
            }}
          >
            <Save className="size-5" />
            حفظ التعديلات
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
