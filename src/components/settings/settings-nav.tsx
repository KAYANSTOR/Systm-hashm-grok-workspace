import { cn } from "@/lib/utils";
import { toneTile } from "@/components/ui/kit";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settings-sections";

/**
 * تنقّل الإعدادات
 * ----------------
 * على الجوال: شريط أفقي قابل للتمرير (لا يستهلك ارتفاعًا من الشاشة الصغيرة).
 * على الحاسوب: قائمة جانبية ثابتة (sticky) مجمّعة، فلا يحتاج المستخدم للتمرير
 * الطويل بين الأقسام كما كان في التصميم السابق (روابط قفز داخل صفحة واحدة).
 */
export function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav aria-label="أقسام الإعدادات" className="lg:sticky lg:top-4 lg:self-start">
      {/* ————— الجوال ————— */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
        role="tablist"
        aria-label="أقسام الإعدادات"
      >
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === active;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(section.id)}
              className={cn("chip-filter shrink-0 gap-1.5", isActive && "chip-filter-active")}
            >
              <Icon className="size-3.5" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* ————— الحاسوب ————— */}
      <div className="hidden overflow-hidden rounded-3xl border border-line/70 bg-paper shadow-soft lg:block">
        {SETTINGS_GROUPS.map((group, index) => {
          const items = SETTINGS_SECTIONS.filter((section) => section.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className={cn("p-2", index > 0 && "border-t border-line/60")}>
              <p className="px-2.5 py-2 text-[11px] font-black tracking-wide text-muted">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === active;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onSelect(item.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2.5 text-right transition",
                          isActive
                            ? "bg-brand-soft text-brand-dark ring-1 ring-brand/25"
                            : "text-muted hover:bg-canvas hover:text-ink",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-xl",
                            isActive ? toneTile(item.tone) : "bg-canvas text-muted",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] font-bold opacity-80">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
