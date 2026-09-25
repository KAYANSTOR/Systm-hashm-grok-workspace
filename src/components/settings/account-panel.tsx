import { useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { forceAllowFetch, useStore } from "@/lib/store";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { canManageAccess } from "@/lib/access";
import { ACCESS_CONTROL, AUTH_REQUIRED } from "@/lib/features";
import { ensureMyAccountIsAdmin } from "@/server/employees";
import { Alert, Chip, KeyValue, SectionCard } from "@/components/ui/kit";
import { AccessControlCard } from "./access-control-card";

/**
 * الحساب والوصول — يجمع كل ما يتعلق بالمستخدم الحالي: الجلسة، تفعيل مدير
 * النظام مرة واحدة، وحالة الموظفين والأدوار (تُعرض فقط عند تفعيل الميزة).
 */
export function AccountPanel() {
  const user = useCurrentUser();
  const userPermissions = useStore((s) => s.userPermissions || []);
  const [promotingAdmin, setPromotingAdmin] = useState(false);

  /** مدير النظام: يملك إدارة الأدوار أو الحسابات أو الموظفين — يُحفظ مرة واحدة في قاعدة البيانات */
  const isAlreadyAdmin = canManageAccess(userPermissions);

  const promoteMe = () => {
    void (async () => {
      setPromotingAdmin(true);
      try {
        const res = await ensureMyAccountIsAdmin();
        // حدّث صلاحيات العميل فورًا حتى يعمل كرت الأدوار والشاشات بدون إعادة تحميل
        forceAllowFetch();
        await useStore.getState().fetchFromDb();
        toast.success(
          `تم تعيين حسابك كمدير النظام مرة واحدة (${(res as { permissionCount?: number })?.permissionCount ?? "—"} صلاحية) وحُفظت الإعدادات.`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تعيين المدير");
      } finally {
        setPromotingAdmin(false);
      }
    })();
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionCard
        title="الحساب"
        subtitle={
          AUTH_REQUIRED
            ? "الجلسة تبقى محفوظة على هذا الجهاز (حتى سنة) إلا عند تسجيل الخروج"
            : "تسجيل الدخول موقوف مؤقتًا — النظام يفتح مباشرة على هذا الجهاز"
        }
        icon={UserCheck}
        tone="navy"
        action={<Chip tone={AUTH_REQUIRED ? "good" : "warn"}>{AUTH_REQUIRED ? "دخول مفعّل" : "دخول موقوف"}</Chip>}
      >
        {AUTH_REQUIRED ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line/70 bg-canvas/40 p-3.5">
              <KeyValue label="المستخدم الحالي" value={user?.displayName || "المستخدم الحالي"} />
              <KeyValue label="حالة الجلسة" value="مرتبطة بهذا الجهاز" tone="good" />
              <KeyValue label="صلاحيات الحساب" value={userPermissions.length} />
            </div>

            {isAlreadyAdmin ? (
              <Alert tone="good" icon={ShieldCheck} title="أنت مدير النظام بالفعل">
                الصلاحيات محفوظة مرة واحدة. يمكنك ضبط أدوار الموظفين دون إعادة التفعيل.
              </Alert>
            ) : (
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={promotingAdmin}
                onClick={promoteMe}
              >
                <ShieldCheck className="size-4" />
                {promotingAdmin ? "جاري التفعيل والحفظ..." : "تفعيل حسابي كمدير النظام (مرة واحدة)"}
              </button>
            )}

            <button
              type="button"
              className="btn-ghost w-full text-bad"
              onClick={() => {
                void signOut("/").catch((error) =>
                  toast.error(error instanceof Error ? error.message : "تعذر تسجيل الخروج"),
                );
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert tone="warn" icon={AlertTriangle} title="لا يوجد تسجيل دخول في هذه المرحلة">
              تم إيقاف الحسابات و«الموظفون والأدوار» مؤقتًا بطلب من صاحب المعمل: كل من يفتح النظام على
              هذا الجهاز يعمل بكامل الشاشات، دون اسم مستخدم ولا كلمة مرور. الكود محفوظ بالكامل
              وسيُعاد تفعيله لاحقًا بإرجاع مفتاح واحد.
              <br />
              <strong className="font-black">لا تشارك رابط النظام مع أي شخص غير موثوق في هذه المرحلة.</strong>
            </Alert>

            <div className="rounded-2xl border border-line/70 bg-canvas/40 p-3.5">
              <KeyValue label="حالة الدخول" value="موقوف مؤقتًا" tone="warn" />
              <KeyValue label="حالة الموظفين والأدوار" value={ACCESS_CONTROL ? "مفعّلة" : "موقوفة مؤقتًا"} tone={ACCESS_CONTROL ? "good" : "warn"} />
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-line/60 pt-4">
          <p className="mb-2 text-xs font-black text-ink">صيانة المزامنة</p>
          <button
            type="button"
            className="btn-ghost w-full text-xs"
            onClick={() => {
              useStore.getState().clearStuckOutbox?.();
              toast.success("تم تنظيف الطابور العالق إن وُجد");
            }}
          >
            <RefreshCw className="size-3.5" />
            تنظيف عمليات المزامنة العالقة
          </button>
          <p className="mt-2 text-[11px] font-bold text-muted">
            استخدمه فقط إذا بقي عدد العمليات المعلقة لا ينقص مع وجود اتصال سليم.
          </p>
        </div>
      </SectionCard>

      {/* الموظفون والأدوار موقوفون مؤقتًا (FEATURES.ACCESS_CONTROL = false) — البطاقة تُخفي نفسها */}
      {ACCESS_CONTROL ? <AccessControlCard /> : null}

      {!ACCESS_CONTROL ? (
        <SectionCard
          title="الموظفون والأدوار"
          subtitle="موقوفة مؤقتًا بطلب من صاحب المعمل"
          icon={Users}
          tone="muted"
        >
          <p className="text-xs font-bold leading-6 text-muted">
            شاشات الموظفين وتحديد الأدوار والصلاحيات مخفية الآن من كل النظام، والكود محفوظ بالكامل.
            عند إعادة التفعيل ستظهر هذه البطاقة تلقائيًا مع روابط «قائمة الموظفين» و«الأدوار
            وصلاحيات الشاشات».
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
