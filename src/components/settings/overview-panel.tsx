import { ArrowLeft, Boxes, Users, Warehouse, Tags } from "lucide-react";
import { useStore } from "@/lib/store";
import { Alert, Chip, SectionCard, StatCard, StatGrid, toneTile } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settings-sections";

/**
 * نظرة عامة على الإعدادات
 * ------------------------
 * أول ما يراه المستخدم: حالة الاتصال والمزامنة، أرقام مرجعية سريعة، ومختصرات
 * تقفز إلى القسم المطلوب مباشرةً — بدل أن يبحث في صفحة طويلة.
 */
export function OverviewPanel({
  onSelect,
}: {
  onSelect: (id: SettingsSectionId) => void;
}) {
  const connectionState = useStore((s) => s.connectionState);
  const pendingSyncCount = useStore((s) => s.pendingSyncCount);
  const lastSyncMessage = useStore((s) => s.lastSyncMessage);
  const initialDataLoaded = useStore((s) => s.initialDataLoaded);
  const warehouses = useStore((s) => s.warehouses || []);
  const productCategories = useStore((s) => s.productCategories || []);
  const customers = useStore((s) => s.customers || []);
  const inventory = useStore((s) => s.inventory || []);

  const isOffline = connectionState === "offline";
  const shortcuts = SETTINGS_SECTIONS.filter((section) => section.id !== "overview");

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionCard
        title="حالة النظام"
        subtitle="مصدر البيانات المحلي والنسخة السحابية"
        icon={Boxes}
        tone={isOffline ? "bad" : "brand"}
        action={
          <Chip tone={isOffline ? "bad" : connectionState === "syncing" ? "brand" : "good"}>
            {connectionState === "syncing"
              ? "جارٍ المزامنة"
              : isOffline
                ? "غير متصل"
                : initialDataLoaded
                  ? "متصل بالسحابة"
                  : "جارٍ التحقق…"}
          </Chip>
        }
      >
        {isOffline ? (
          <Alert tone="bad" icon={Boxes} title="الوضع المحلي مفعّل">
            التغييرات تُحفظ على هذا الجهاز وتُرحَّل تلقائيًا عند عودة الإنترنت. لا تغلق الجهاز قبل رؤية
            «لا عمليات معلقة».
          </Alert>
        ) : null}
        {pendingSyncCount > 0 ? (
          <Alert tone="warn" icon={Boxes} title={`${pendingSyncCount} عملية بانتظار الترحيل`}>
            افتح قسم «التخزين والمزامنة» واضغط «مزامنة الآن» لرفع العمليات إلى السحابة.
          </Alert>
        ) : null}
        <p className="mt-3 text-xs font-bold text-muted">
          آخر حالة: {lastSyncMessage || "لم تُسجَّل مزامنة بعد"}
        </p>
      </SectionCard>

      <StatGrid cols={4}>
        <StatCard label="العملاء والموردون" value={customers.length} icon={Users} tone="navy" />
        <StatCard label="أصناف المخزون" value={inventory.length} icon={Boxes} tone="brand" />
        <StatCard label="المخازن" value={warehouses.length} icon={Warehouse} tone="good" />
        <StatCard label="الفئات" value={productCategories.length} icon={Tags} tone="gold" />
      </StatGrid>

      <SectionCard title="مختصرات" subtitle="انتقل مباشرةً إلى القسم الذي تريد تعديله" icon={ArrowLeft}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {shortcuts.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelect(section.id)}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-3 text-right transition",
                  "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      toneTile(section.tone),
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-ink">{section.label}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-muted">
                      {section.hint}
                    </span>
                  </span>
                </span>
                <ArrowLeft className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-x-1 group-hover:text-brand" />
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
