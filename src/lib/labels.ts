import type {
  CustomerType,
  ExpenseKind,
  InventoryCategory,
  InventoryUnit,
  InvoiceKind,
  InvoiceSalesType,
  InvoiceStatus,
  PartyKind,
  PaymentMethod,
  PaymentType,
  VoucherType,
} from "./types";

export const categoryLabel: Record<InventoryCategory, string> = {
  fabric: "أقمشة",
  thread: "خيوط",
  accessory: "إكسسوارات",
  machine_part: "قطع غيار",
};

export const unitLabel: Record<InventoryUnit, string> = {
  meter: "متر",
  roll: "طاقة / رول",
  piece: "قطعة",
  kg: "كجم",
};

export const customerTypeLabel: Record<CustomerType, string> = {
  retail: "مفرد",
  wholesale: "جملة",
};

export const invoiceKindLabel: Record<InvoiceKind, string> = {
  sale: "مبيعات",
  purchase: "مشتريات",
};

export const salesTypeLabel: Record<InvoiceSalesType, string> = {
  PRODUCT_SALE: "بيع بضاعة",
  SERVICE: "خدمة تطريز",
};

export const paymentTypeLabel: Record<PaymentType, string> = {
  cash: "نقدي",
  deferred: "آجل",
  partial: "جزئي",
};

export const statusLabel: Record<InvoiceStatus, string> = {
  paid: "مدفوعة",
  partial: "جزئية",
  unpaid: "آجلة",
};

export const voucherTypeLabel: Record<VoucherType, string> = {
  receipt: "سند قبض",
  payment: "سند صرف",
  deferred: "آجل",
  journal: "قيد يومية",
};

export const partyKindLabel: Record<PartyKind, string> = {
  customer: "عميل",
  supplier: "مورد",
  other: "أخرى",
};

export const methodLabel: Record<PaymentMethod, string> = {
  cash: "نقدي",
  remittance: "حوالة",
  jeeb: "جيب",
  e_wallet: "محفظة إلكترونية",
};

export const expenseKindLabel: Record<ExpenseKind, string> = {
  work: "عمل",
  personal: "شخصي",
};

export const expenseCategories = [
  "إيجار",
  "كهرباء",
  "رواتب",
  "صيانة",
  "نقل وشحن",
  "مستلزمات",
  "ضيافة",
  "أخرى",
] as const;
