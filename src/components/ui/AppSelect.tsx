import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
};

/** Design-system select — no native <select> chrome. RTL-friendly. */
export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "اختر…",
  searchable = true,
  clearable = false,
  disabled = false,
  label,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return options;
    return options.filter(
      (o) => o.label.includes(term) || o.description?.includes(term) || o.value.includes(term),
    );
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label ? <span className="mb-1 block text-xs font-bold text-muted">{label}</span> : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="input-field flex w-full items-center justify-between gap-2 text-right"
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={selected ? "font-bold text-ink" : "text-muted"}>
          {selected?.label || placeholder}
        </span>
        <span className="flex items-center gap-1 text-muted">
          {clearable && value ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded-lg p-0.5 hover:bg-brand-soft hover:text-brand"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <X className="size-4" />
            </span>
          ) : null}
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-2xl border border-line bg-paper shadow-lg"
        >
          {searchable ? (
            <div className="relative border-b border-line p-2">
              <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                className="w-full rounded-xl border border-line bg-canvas py-2 pr-9 pl-3 text-sm font-bold outline-none focus:border-brand"
                placeholder="بحث…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
          ) : null}
          <ul className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted">لا توجد نتائج</li>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={o.disabled}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right text-sm font-bold transition ${
                        active ? "bg-brand-soft text-brand" : "text-ink hover:bg-canvas"
                      } disabled:opacity-40`}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.description ? (
                          <span className="block truncate text-xs font-medium text-muted">{o.description}</span>
                        ) : null}
                      </span>
                      {active ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
