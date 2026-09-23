import { useMemo } from "react";
import { formatMoney } from "@/lib/utils";

/**
 * مخطط أعمدة «المبيعات اليومية» — CSS/HTML خالص بلا مكتبة رسوم.
 *
 * سبب استبدال recharts: حزمة recharts 2.x تعتمد على lodash (CommonJS)، وكان
 * استيرادها في مسار العرض على الخادم (SSR) يرمي «require is not defined»
 * فترجع شاشة التقارير بخطأ 500 في المعاينة الحية. المخطط هنا بلا اعتماديات،
 * ويتصرف بشكل صحيح في العرض على الخادم وعلى العميل، وأسرع في التنقل.
 */
export type DailySalesPoint = { date: string; total: number };

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

export default function DailySalesChart({
  data,
  height = 224,
}: {
  data: DailySalesPoint[];
  height?: number;
}) {
  const { max, ticks, total } = useMemo(() => {
    const peak = data.reduce((best, point) => Math.max(best, Number(point.total) || 0), 0);
    const ceiling = niceCeil(peak);
    const sum = data.reduce((acc, point) => acc + (Number(point.total) || 0), 0);
    return {
      max: ceiling,
      total: sum,
      ticks: ceiling
        ? [ceiling, ceiling * 0.75, ceiling * 0.5, ceiling * 0.25, 0].map((value) => Math.round(value))
        : [],
    };
  }, [data]);

  if (!data.length) return null;

  // مع أكثر من 14 يومًا نُظهر تاريخًا من كل يومين أو ثلاثة حتى لا تتلاصق البطاقات.
  const labelEvery = data.length > 20 ? 5 : data.length > 12 ? 3 : data.length > 7 ? 2 : 1;
  const showValues = data.length <= 12;

  return (
    <div className="w-full" dir="ltr">
      <div className="flex items-stretch gap-2" style={{ height }}>
        {ticks.length ? (
          <div className="flex w-16 shrink-0 flex-col justify-between pb-6 pl-1 text-left">
            {ticks.map((tick) => (
              <span key={tick} className="num text-[10px] font-bold text-muted">
                {formatMoney(tick)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative flex-1">
          {ticks.length ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6">
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  className={
                    index === ticks.length - 1
                      ? "block h-px w-full bg-line"
                      : "block h-px w-full bg-line/60 [background-image:repeating-linear-gradient(to_right,var(--color-line)_0,var(--color-line)_4px,transparent_4px,transparent_9px)] [background-color:transparent]"
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="relative flex h-full items-end gap-[3px] pb-6">
            {data.map((point, index) => {
              const value = Number(point.total) || 0;
              const ratio = max ? Math.min(1, value / max) : 0;
              const highlight = value > 0 && value >= max * 0.75;
              return (
                <div key={`${point.date}-${index}`} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-bold text-canvas group-hover:block"
                    role="tooltip"
                  >
                    <span className="num">{point.date}</span> · <span className="num">{formatMoney(value)}</span>
                  </div>
                  {showValues && value > 0 ? (
                    <span className="num mb-1 text-center text-[9px] font-bold text-muted">{formatMoney(value)}</span>
                  ) : null}
                  <div
                    className={`w-full rounded-t-[6px] transition-[height,background-color] duration-300 ${
                      highlight ? "bg-brand-dark" : "bg-brand/70 group-hover:bg-brand"
                    }`}
                    style={{ height: value > 0 ? `${Math.max(3, ratio * 100)}%` : "2px", opacity: value > 0 ? 1 : 0.35 }}
                    title={`${point.date}: ${formatMoney(value)}`}
                    aria-label={`${point.date}: ${formatMoney(value)}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-[3px]">
            {data.map((point, index) => (
              <span
                key={`label-${point.date}-${index}`}
                className="num flex-1 truncate text-center text-[9px] font-bold text-muted"
              >
                {index % labelEvery === 0 ? point.date : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold text-muted">
        إجمالي المخطط <span className="num">{formatMoney(total)}</span> ر.ي · أعلى يوم{" "}
        <span className="num">{formatMoney(max)}</span> ر.ي
      </p>
    </div>
  );
}
