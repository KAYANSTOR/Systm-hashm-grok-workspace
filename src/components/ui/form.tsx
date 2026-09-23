import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * حقول النماذج الموحّدة
 * ---------------------
 * كانت شاشات الإدخال تستخدم `<label>` و`<span class="label">` و`<input>` مبعثرة
 * بلا تسمية موحّدة ولا رسائل خطأ ولا أيقونات، فيصعب على المحاسب معرفة ما يكتبه
 * وأين الخطأ. هذه المكوّنات تُعطي كل حقل: تسمية واضحة + أيقونة + تلميح + خطأ،
 * وتمنع تكرار الأنماط في كل شاشة.
 */

export function FormSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  tone = "brand",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "brand" | "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "bg-good-soft text-good"
      : tone === "bad"
        ? "bg-bad-soft text-bad"
        : tone === "warn"
          ? "bg-warn-soft text-warn"
          : "bg-brand-soft text-brand";

  return (
    <section
      className={cn(
        "rounded-2xl border border-line/70 bg-paper p-3.5 shadow-soft sm:p-4",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>
              <Icon className="size-4" />
            </span>
          ) : null}
          <div>
            <h3 className="text-sm font-black text-ink">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-[11px] font-bold text-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/** تسمية حقل موحّدة مع أيقونة اختيارية. */
export function FieldLabel({
  children,
  icon: Icon,
  required,
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  required?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-black text-muted", className)}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      {children}
      {required ? <span className="text-bad">•</span> : null}
    </span>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  icon?: LucideIcon;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** حجم الخط في الحقل — «lg» لخانات المبالغ المهمة. */
  scale?: "md" | "lg";
  className?: string;
  inputClassName?: string;
};

export function TextField({
  label,
  icon,
  hint,
  error,
  required,
  scale = "md",
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  return (
    <label className={cn("block", className)}>
      <FieldLabel icon={icon} required={required}>
        {label}
      </FieldLabel>
      <input
        {...inputProps}
        className={cn(
          "input-field",
          scale === "lg" && "text-lg font-black",
          error && "border-bad focus:border-bad focus:ring-bad/15",
          inputClassName,
        )}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <span className="mt-1.5 block text-[11px] font-black text-bad">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * حقل مبلغ مالي: خط كبير + محاذاة أرقام + تلميح الاختصار.
 * يستخدم `inputMode="decimal"` ليظهر لوحة الأرقام على الجوال مباشرة.
 */
export function MoneyField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  icon,
  placeholder = "0",
  suffix = "ر.ي",
  onEnter,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  icon?: LucideIcon;
  placeholder?: string;
  suffix?: string;
  onEnter?: () => void;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <FieldLabel icon={icon} required={required}>
        {label}
      </FieldLabel>
      <span className="relative block">
        <input
          className={cn(
            "input-field num pl-14 text-lg font-black tracking-wide",
            error && "border-bad focus:border-bad focus:ring-bad/15",
          )}
          inputMode="decimal"
          dir="ltr"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onEnter) {
              event.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={error ? true : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-muted">
            {suffix}
          </span>
        ) : null}
      </span>
      {error ? (
        <span className="mt-1.5 block text-[11px] font-black text-bad">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

/** شريط ملخص ثابت أعلى أزرار الحفظ — يرى المحاسب النتيجة قبل أن يحفظ. */
export function TotalsBar({
  title = "الملخص",
  lines,
  className,
}: {
  title?: string;
  lines: Array<{
    label: string;
    value: ReactNode;
    tone?: "brand" | "good" | "bad" | "muted";
    strong?: boolean;
  }>;
  className?: string;
}) {
  const toneClass = {
    brand: "text-brand-dark",
    good: "text-good",
    bad: "text-bad",
    muted: "text-muted",
  } as const;

  return (
    <div className={cn("rounded-2xl border border-brand/25 bg-brand-soft/60 p-3.5", className)}>
      <p className="mb-2 text-[11px] font-black tracking-wide text-brand-dark">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl bg-paper/80 px-3 py-2",
              line.strong && "border border-brand/20 shadow-soft",
            )}
          >
            <span className="text-[11px] font-bold text-muted">{line.label}</span>
            <span className={cn("num text-sm font-black", toneClass[line.tone || "brand"])}>
              {line.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
