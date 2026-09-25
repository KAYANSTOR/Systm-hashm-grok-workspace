import { useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Cloud, Database, Info, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { Chip, PageHeader } from "@/components/ui/kit";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DEFAULT_SETTINGS_SECTION, type SettingsSectionId } from "@/components/settings/settings-sections";
import { OverviewPanel } from "@/components/settings/overview-panel";
import { OrganizationPanel } from "@/components/settings/organization-panel";
import { AccountPanel } from "@/components/settings/account-panel";
import { SyncPanel } from "@/components/settings/sync-panel";
import { CatalogPanel } from "@/components/settings/catalog-panel";
import { BackupPanel } from "@/components/settings/backup-panel";
import { DangerPanel } from "@/components/settings/danger-panel";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

/**
 * شاشة الإعدادات — قشرة (Shell) فقط
 * ----------------------------------
 * كانت هذه الشاشة ملفًا واحدًا بطول 700 سطر يجمع كل الأقسام معًا في شبكة
 * قابلة للتمرير الطويل. الآن:
 *   • قائمة جانبية ثابتة على الحاسوب وشريط أفقي على الجوال،
 *   • قسم واحد ظاهر في كل مرة (تبويب حقيقي) فلا تمرير طويل ولا تشتيت،
 *   • كل قسم في ملف مستقل تحت `src/components/settings/`،
 *   • وسجل الأقسام في `settings-sections.ts` كي لا تتكرر القائمة.
 * المنطق نفسه لم يتغير: نفس الدوال ونفس رسائل النجاح والخطأ ونفس بنية النسخة
 * الاحتياطية وعبارة تأكيد التصفية.
 */
function SettingsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // مسارات الإعدادات الفرعية (مثل /settings/access-control) تُعرض كما هي.
  return pathname !== "/settings" ? <Outlet /> : <SettingsRootPage />;
}

function SettingsRootPage() {
  const [active, setActive] = useState<SettingsSectionId>(DEFAULT_SETTINGS_SECTION);

  /**
   * قيم المتجر التالية تُبنى على العميل (من `navigator.onLine` أو من التخزين
   * المحلي) فلا وجود لها على الخادم. نعرضها فقط بعد اكتمال الترطيب، وإلا فشل
   * ترطيب React كما كان يحدث في هذه الشاشة.
   */
  const hydrated = useHydrated();
  const connectionState = useStore((s) => s.connectionState);
  const pendingSyncCount = useStore((s) => s.pendingSyncCount);
  const initialDataLoaded = useStore((s) => s.initialDataLoaded);
  const lastSyncMessage = useStore((s) => s.lastSyncMessage);

  const displayState = hydrated ? connectionState : "unknown";
  const statusChip =
    displayState === "unknown"
      ? { tone: "muted" as const, icon: Cloud, label: "جارٍ التحقق…" }
      : displayState === "offline"
        ? { tone: "bad" as const, icon: Database, label: "غير متصل" }
        : displayState === "syncing"
          ? { tone: "brand" as const, icon: Cloud, label: "جارٍ المزامنة" }
          : {
              tone: "good" as const,
              icon: Cloud,
              label: initialDataLoaded ? "متصل بالسحابة" : "متصل — جارٍ جلب البيانات",
            };
  const pendingChip =
    hydrated && pendingSyncCount > 0
      ? { tone: "warn" as const, label: `${pendingSyncCount} عملية معلقة` }
      : { tone: "muted" as const, label: "لا عمليات معلقة" };
  const StatusIcon = statusChip.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 pb-10 sm:space-y-6 sm:px-0">
      <PageHeader
        title="الإعدادات"
        subtitle="تخصيص النظام، البيانات، والمزامنة — متوافق مع الهاتف والكمبيوتر."
        icon={Settings2}
        tone="brand"
        meta={
          <>
            <Chip tone={statusChip.tone} icon={StatusIcon}>
              {statusChip.label}
            </Chip>
            <Chip tone={pendingChip.tone}>{pendingChip.label}</Chip>
          </>
        }
      />

      {hydrated && lastSyncMessage ? (
        <p className="text-[11px] font-bold text-muted">آخر حالة: {lastSyncMessage}</p>
      ) : null}

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <SettingsNav active={active} onSelect={setActive} />

        <div className="min-w-0" role="tabpanel" aria-label="قسم الإعدادات المفتوح">
          {hydrated ? (
            <>
              {active === "overview" ? <OverviewPanel onSelect={setActive} /> : null}
              {active === "organization" ? <OrganizationPanel /> : null}
              {active === "account" ? <AccountPanel /> : null}
              {active === "sync" ? <SyncPanel /> : null}
              {active === "catalog" ? <CatalogPanel /> : null}
              {active === "backup" ? <BackupPanel /> : null}
              {active === "danger" ? <DangerPanel /> : null}
            </>
          ) : (
            <SettingsPanelSkeleton />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 pb-4 pt-6 text-muted">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Info className="size-4" />
          معمل هاشم · الإصدار 2.0 (متزامن سحابياً)
        </div>
        <p className="text-[11px] uppercase tracking-widest opacity-80">Cloud · Offline-first</p>
      </div>
    </div>
  );
}

/**
 * هيكل تحميل يظهر في اللحظة القصيرة قبل اكتمال الترطيب، بدل فراغ أبيض.
 * الأقسام نفسها لا تُرسم إلا بعد الترطيب لأن قيمها تُقرأ من التخزين المحلي
 * ومن `navigator.onLine`، فرسمها على الخادم كان يُفشل ترطيب React.
 */
function SettingsPanelSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="card overflow-hidden">
        <div className="border-b border-line/70 px-4 py-3 sm:px-5">
          <div className="h-5 w-40 animate-pulse rounded-xl bg-canvas" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded-lg bg-canvas" />
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="h-11 w-full animate-pulse rounded-2xl bg-canvas" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-11 animate-pulse rounded-2xl bg-canvas" />
            <div className="h-11 animate-pulse rounded-2xl bg-canvas" />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-3xl bg-paper" />
        <div className="h-24 animate-pulse rounded-3xl bg-paper" />
      </div>
    </div>
  );
}
