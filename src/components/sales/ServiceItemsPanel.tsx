import type { EmbroideryUnit, InvoiceLine } from "@/lib/types";
import {
  embroideryFieldLabels,
  embroideryUnitLabel,
  embroideryUnitOptions,
  resolveEmbroideryUnit,
} from "@/lib/embroidery";
import { FieldLabel, MoneyField, TextField } from "@/components/ui/form";
import { Money } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/utils";
import { Plus, Tag, Trash2 } from "lucide-react";

type Props = {
  serviceName: string;
  setServiceName: (v: string) => void;
  serviceDesc: string;
  setServiceDesc: (v: string) => void;
  serviceUnit: EmbroideryUnit;
  setServiceUnit: (v: EmbroideryUnit) => void;
  qty: string;
  setQty: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  serviceDraftTotal: number;
  lineError: (raw: string) => string | undefined;
  onAddLine: () => void;
  items: InvoiceLine[];
  updateLine: (index: number, patch: Partial<InvoiceLine>) => void;
  removeLine: (index: number) => void;
  serviceSuggestions: string[];
  pendingReceiptReview?: boolean;
};

export function ServiceItemsPanel({
  serviceName,
  setServiceName,
  serviceDesc,
  setServiceDesc,
  serviceUnit,
  setServiceUnit,
  qty,
  setQty,
  price,
  setPrice,
  serviceDraftTotal,
  lineError,
  onAddLine,
  items,
  updateLine,
  removeLine,
  serviceSuggestions,
  pendingReceiptReview,
}: Props) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel required>نوع وحدة خدمة التطريز</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {embroideryUnitOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={
                serviceUnit === opt.value
                  ? "chip-filter bg-brand text-white border-brand"
                  : "chip-filter"
              }
              onClick={() => setServiceUnit(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-6"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAddLine();
          }
        }}
      >
        <TextField
          label="البيان / اسم الخدمة"
          icon={Tag}
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder={
            serviceUnit === "taqa"
              ? "مثال: تطريز طيقان فستان"
              : serviceUnit === "war"
                ? "مثال: تطريز وار قماش"
                : "مثال: تطريز فرشات مخدات"
          }
          className="sm:col-span-3"
        />
        <TextField
          label={embroideryFieldLabels(serviceUnit).quantity}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          error={lineError(qty)}
          className="num sm:col-span-1"
        />
        <MoneyField
          label={embroideryFieldLabels(serviceUnit).unitPrice}
          value={price}
          onChange={setPrice}
          error={lineError(price)}
          className="sm:col-span-1"
        />
        <div className="rounded-2xl bg-brand-soft/70 px-3 py-2 text-center sm:col-span-1">
          <p className="text-[11px] font-black text-muted">
            {embroideryFieldLabels(serviceUnit).total}
          </p>
          <Money value={formatCurrency(serviceDraftTotal)} className="text-sm text-brand-dark" />
        </div>
        <TextField
          label="وصف تفصيلي (اختياري)"
          value={serviceDesc}
          onChange={(e) => setServiceDesc(e.target.value)}
          placeholder="نوع القماش أو لون الخيط…"
          className="sm:col-span-4"
        />
        <div className="flex items-end sm:col-span-2">
          <button type="button" className="btn-primary w-full" onClick={onAddLine}>
            <Plus className="size-4" />
            إضافة البند
          </button>
        </div>
      </div>

      {serviceSuggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black text-muted">خدمات سابقة:</span>
          {serviceSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="chip-filter"
              onClick={() => setServiceName(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70">
          {items.map((line, idx) => {
            const unit = resolveEmbroideryUnit(line) || "taqa";
            return (
              <li key={line.id} className="bg-paper p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {pendingReceiptReview ? (
                      <input
                        className="input-field"
                        value={line.name}
                        placeholder="اسم الصنف"
                        onChange={(e) => updateLine(idx, { name: e.target.value })}
                      />
                    ) : (
                      <p className="truncate text-sm font-black text-ink">
                        {idx + 1}. {line.name}
                        <span className="ms-2 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-dark">
                          {embroideryUnitLabel[unit]}
                        </span>
                      </p>
                    )}
                    {line.description ? (
                      <p className="truncate text-[11px] font-bold text-muted">{line.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn-icon size-8 text-bad hover:bg-bad-soft hover:text-bad"
                    aria-label={`حذف البند ${idx + 1}`}
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {embroideryUnitOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={
                          unit === opt.value
                            ? "chip-filter bg-brand text-white border-brand"
                            : "chip-filter"
                        }
                        onClick={() => updateLine(idx, { serviceUnit: opt.value })}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                    <TextField
                      label={embroideryFieldLabels(unit).quantity}
                      value={String(line.serviceQuantity ?? line.quantity)}
                      onChange={(e) =>
                        updateLine(idx, {
                          serviceQuantity: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                        })
                      }
                      inputMode="decimal"
                      className="num"
                    />
                    <MoneyField
                      label={embroideryFieldLabels(unit).unitPrice}
                      value={String(line.serviceUnitPrice ?? line.unitPrice)}
                      onChange={(value) =>
                        updateLine(idx, {
                          serviceUnitPrice: Number(value.replace(/[^\d.]/g, "")) || 0,
                        })
                      }
                    />
                    <div className="rounded-2xl bg-canvas/60 px-3 py-2 text-center">
                      <p className="text-[11px] font-black text-muted">الوحدة</p>
                      <p className="text-sm font-black text-ink">{embroideryUnitLabel[unit]}</p>
                    </div>
                    <div className="rounded-2xl bg-brand-soft/70 px-3 py-2 text-center">
                      <p className="text-[11px] font-black text-muted">{embroideryFieldLabels(unit).total}</p>
                      <Money value={formatCurrency(line.total)} className="text-sm text-brand-dark" />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs font-bold text-muted">
          لم تُضَف بنود بعد — اختر نوع الوحدة ثم أضف أول بند.
        </p>
      )}
    </div>
  );
}
