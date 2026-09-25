import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * عدة واجهة موحّدة (Design System Kit)
 * ------------------------------------
 * كل شاشات النظام تُبنى من هذه المكوّنات لتضمن تناسقًا بصريًا كاملًا:
 * عناوين الصفحات، بطاقات الأرقام، التبويبات، الشرائح، الصفوف، التنبيهات.
 */

export type Tone = "brand" | "good" | "bad" | "warn" | "accent" | "navy" | "gold" | "muted";

const TONE_TILE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
  navy: "bg-navy-soft text-navy",
  gold: "bg-gold-soft text-gold",
  muted: "bg-canvas text-muted",
};

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  accent: "text-accent",
  navy: "text-navy",
  gold: "text-gold",
  muted: "text-muted",
};

const TONE_CHIP: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-dark",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
  navy: "bg-navy-soft text-navy",
  gold: "bg-gold-soft text-gold",
  muted: "bg-canvas text-muted",
};

const TONE_ALERT: Record<Tone, string> = {
  brand: "border-brand/25 bg-brand-soft/70 text-brand-dark",
  good: "border-good/25 bg-good-soft/80 text-good",
  bad: "border-bad/25 bg-bad-soft/80 text-bad",
  warn: "border-warn/30 bg-warn-soft/80 text-warn",
  accent: "border-accent/25 bg-accent-soft/80 text-accent",
  navy: "border-navy/20 bg-navy-soft/80 text-navy",
  gold: "border-gold/25 bg-gold-soft/80 text-gold",
  muted: "border-line bg-canvas text-muted",
};

export function toneTile(tone: Tone) {
  return TONE_TILE[tone];
}
export function toneText(tone: Tone) {
  return TONE_TEXT[tone];
}

/* ————————————————— رأس الصفحة ————————————————— */

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  tone = "brand",
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className={cn("tile-icon size-12 rounded-2xl shadow-soft", TONE_TILE[tone])}>
            <Icon className="size-6" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ————————————————— الشرائح ————————————————— */

export function Chip({
  tone = "muted",
  children,
  icon: Icon,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span className={cn("chip", TONE_CHIP[tone], className)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("chip-filter", active && "chip-filter-active")}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </button>
  );
}

/* ————————————————— التبويبات ————————————————— */

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentOption<T>>;
  className?: string;
}) {
  return (
    <div className={cn("segmented", className)} role="tablist">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn("segmented-item", active && "segmented-item-active")}
          >
            {Icon ? <Icon className="size-4" /> : null}
            <span className="truncate">{opt.label}</span>
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "num rounded-full px-1.5 py-0.5 text-[11px] font-black",
                  active ? "bg-brand-fg/20 text-brand-fg" : "bg-canvas-deep text-muted",
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ————————————————— بطاقة الأرقام ————————————————— */

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  hint,
  to,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  to?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black tracking-wide text-muted">{label}</span>
        {Icon ? (
          <span
            className={cn("flex size-8 items-center justify-center rounded-xl", TONE_TILE[tone])}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className={cn("num mt-2 text-xl font-black leading-none sm:text-2xl", TONE_TEXT[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] font-bold text-muted">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to as never}
        preload="intent"
        className={cn("card card-hover block p-4", className)}
      >
        {body}
      </Link>
    );
  }
  return <div className={cn("card p-4", className)}>{body}</div>;
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-2 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

/* ————————————————— بطاقة قسم ————————————————— */

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  tone = "brand",
  action,
  children,
  bodyClassName,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span
              className={cn("flex size-9 items-center justify-center rounded-xl", TONE_TILE[tone])}
            >
              <Icon className="size-5" />
            </span>
          ) : null}
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ————————————————— التنبيهات ————————————————— */

export function Alert({
  tone = "brand",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        TONE_ALERT[tone],
        className,
      )}
    >
      {Icon ? <Icon className="mt-0.5 size-5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{title}</p>
        {children ? <div className="mt-0.5 text-xs font-bold opacity-90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ————————————————— عناصر مساعدة ————————————————— */

export function Avatar({
  name,
  tone = "brand",
  className,
}: {
  name: string;
  tone?: Tone;
  className?: string;
}) {
  const initials = name.trim().slice(0, 1) || "?";
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black",
        TONE_TILE[tone],
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "بحث…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        className="input-search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Meter({
  value,
  max,
  tone = "brand",
  className,
}: {
  value: number;
  max: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill: Record<Tone, string> = {
    brand: "bg-brand",
    good: "bg-good",
    bad: "bg-bad",
    warn: "bg-warn",
    accent: "bg-accent",
    navy: "bg-navy",
    gold: "bg-gold",
    muted: "bg-muted",
  };
  return (
    <div className={cn("meter", className)} role="progressbar" aria-valuenow={Math.round(pct)}>
      <div className={cn("meter-fill", fill[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Money({
  value,
  tone,
  prefix,
  className,
}: {
  value: string;
  tone?: Tone;
  prefix?: string;
  className?: string;
}) {
  return (
    <span className={cn("num font-black", tone && TONE_TEXT[tone], className)} dir="ltr">
      {prefix}
      {value}
    </span>
  );
}

export function KeyValue({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs font-bold text-muted">{label}</span>
      <span className={cn("num text-sm font-black", tone ? TONE_TEXT[tone] : "text-ink")}>
        {value}
      </span>
    </div>
  );
}
