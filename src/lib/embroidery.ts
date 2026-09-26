import type { EmbroideryUnit, InvoiceLine } from "./types";

/** تسميات وحدات خدمة التطريز بالعربية */
export const embroideryUnitLabel: Record<EmbroideryUnit, string> = {
  taqa: "طاقة",
  war: "وار",
  brush: "فرشات",
};

export const embroideryUnitOptions: { value: EmbroideryUnit; label: string }[] = [
  { value: "taqa", label: "طاقة" },
  { value: "war", label: "وار" },
  { value: "brush", label: "فرشات" },
];

/** تسميات الحقول حسب نوع الوحدة */
export function embroideryFieldLabels(unit: EmbroideryUnit): {
  quantity: string;
  unitPrice: string;
  total: string;
} {
  if (unit === "taqa") {
    return {
      quantity: "عدد الطيقان",
      unitPrice: "سعر الطاق الواحد",
      total: "إجمالي خدمة الطيقان",
    };
  }
  if (unit === "war") {
    return {
      quantity: "عدد الوارات",
      unitPrice: "سعر الوار الواحد",
      total: "إجمالي خدمة الوار",
    };
  }
  return {
    quantity: "عدد الفرشات",
    unitPrice: "سعر الفرشة الواحدة",
    total: "إجمالي خدمة الفرشات",
  };
}

const UNIT_ALIASES: Record<string, EmbroideryUnit> = {
  taqa: "taqa",
  طاقة: "taqa",
  طاقه: "taqa",
  طاق: "taqa",
  war: "war",
  وار: "war",
  brush: "brush",
  فرشات: "brush",
  فرشة: "brush",
  فرشه: "brush",
};

/** يستنتج وحدة التطريز من الحقل المنظم أو من نص الوحدة المخزّن */
export function resolveEmbroideryUnit(
  line: Pick<InvoiceLine, "serviceUnit" | "unit">,
): EmbroideryUnit | undefined {
  if (line.serviceUnit === "taqa" || line.serviceUnit === "war" || line.serviceUnit === "brush") {
    return line.serviceUnit;
  }
  const raw = (line.unit || "").trim().toLowerCase();
  if (!raw) return undefined;
  if (UNIT_ALIASES[raw]) return UNIT_ALIASES[raw];
  if (raw.includes("طاق")) return "taqa";
  if (raw.includes("وار")) return "war";
  if (raw.includes("فرش")) return "brush";
  return undefined;
}

/** يحسب إجمالي بند خدمة التطريز */
export function computeServiceLineTotal(quantity: number, unitPrice: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const p = Number.isFinite(unitPrice) ? unitPrice : 0;
  return Math.round(q * p * 100) / 100;
}

/**
 * يبني بند خدمة تطريز كاملًا: الحقول المنظمة + الحقول العامة المتوافقة.
 * quantity / unit / unitPrice تُزامَن دائمًا مع service* للطباعة والتقارير القديمة.
 */
export function buildServiceLine(input: {
  id: string;
  name: string;
  description?: string;
  serviceUnit: EmbroideryUnit;
  serviceQuantity: number;
  serviceUnitPrice: number;
}): InvoiceLine {
  const serviceQuantity = Number(input.serviceQuantity) || 0;
  const serviceUnitPrice = Number(input.serviceUnitPrice) || 0;
  const total = computeServiceLineTotal(serviceQuantity, serviceUnitPrice);
  return {
    id: input.id,
    inventoryItemId: "SERVICE",
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    serviceUnit: input.serviceUnit,
    serviceQuantity,
    serviceUnitPrice,
    quantity: serviceQuantity,
    unit: embroideryUnitLabel[input.serviceUnit],
    unitPrice: serviceUnitPrice,
    total,
  };
}

/** يحدّث بند خدمة مع إعادة حساب الإجمالي ومزامنة الحقول العامة */
export function patchServiceLine(
  line: InvoiceLine,
  patch: Partial<
    Pick<
      InvoiceLine,
      "name" | "description" | "serviceUnit" | "serviceQuantity" | "serviceUnitPrice"
    >
  >,
): InvoiceLine {
  const serviceUnit = patch.serviceUnit ?? resolveEmbroideryUnit(line) ?? "taqa";
  const serviceQuantity =
    patch.serviceQuantity !== undefined
      ? Number(patch.serviceQuantity) || 0
      : Number(line.serviceQuantity ?? line.quantity) || 0;
  const serviceUnitPrice =
    patch.serviceUnitPrice !== undefined
      ? Number(patch.serviceUnitPrice) || 0
      : Number(line.serviceUnitPrice ?? line.unitPrice) || 0;
  return buildServiceLine({
    id: line.id,
    name: patch.name !== undefined ? patch.name : line.name,
    description: patch.description !== undefined ? patch.description : line.description,
    serviceUnit,
    serviceQuantity,
    serviceUnitPrice,
  });
}

/** يenrich بنود الفاتورة عند التحميل من قاعدة البيانات */
export function hydrateInvoiceLine(item: InvoiceLine, isServiceInvoice: boolean): InvoiceLine {
  if (!isServiceInvoice && item.inventoryItemId !== "SERVICE") {
    return item;
  }
  const serviceUnit = resolveEmbroideryUnit(item);
  if (!serviceUnit) {
    return item;
  }
  const serviceQuantity = Number(item.serviceQuantity ?? item.quantity) || 0;
  const serviceUnitPrice = Number(item.serviceUnitPrice ?? item.unitPrice) || 0;
  return {
    ...item,
    serviceUnit,
    serviceQuantity,
    serviceUnitPrice,
    quantity: serviceQuantity,
    unit: embroideryUnitLabel[serviceUnit],
    unitPrice: serviceUnitPrice,
    total: computeServiceLineTotal(serviceQuantity, serviceUnitPrice),
  };
}

/** كمية وحدة معينة لعمود الطباعة */
export function printQtyForUnit(line: InvoiceLine, unit: EmbroideryUnit): string | number {
  const resolved = resolveEmbroideryUnit(line);
  if (resolved !== unit) return "—";
  const qty = Number(line.serviceQuantity ?? line.quantity) || 0;
  return qty;
}
