import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  className?: string;
};

/** Custom RTL date picker using design tokens — not native date input chrome. */
export function AppDatePicker({ value, onChange, label, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const base = value ? parseIso(value) : new Date();
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);

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

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    // Sunday=0 → map to Saturday-start week for Arabic display: shift so Sat is first
    // Display order: ح ن ث ر خ ج س — treat Saturday as start (6)
    const startOffset = (first.getDay() + 1) % 7; // make Saturday index 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const today = toIso(new Date());

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label ? <span className="mb-1 block text-xs font-bold text-muted">{label}</span> : null}
      <button
        type="button"
        className="input-field flex w-full items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="font-bold tabular-nums">{value || "اختر التاريخ"}</span>
        <CalendarDays className="size-4 text-muted" />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 w-72 rounded-2xl border border-line bg-paper p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn-icon size-8"
              aria-label="الشهر التالي"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-black">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </p>
            <button
              type="button"
              className="btn-icon size-8"
              aria-label="الشهر السابق"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`e-${i}`} />;
              const iso = toIso(d);
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`flex size-9 items-center justify-center rounded-xl text-sm font-bold transition ${
                    selected
                      ? "bg-brand text-brand-fg"
                      : isToday
                        ? "bg-brand-soft text-brand"
                        : "text-ink hover:bg-canvas"
                  }`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 border-t border-line pt-2">
            <button
              type="button"
              className="btn-ghost flex-1 py-2 text-xs"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              اليوم
            </button>
            <button type="button" className="btn-secondary flex-1 py-2 text-xs" onClick={() => setOpen(false)}>
              إغلاق
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
