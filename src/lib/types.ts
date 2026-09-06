export type CustomerType = "retail" | "wholesale";
export type InventoryCategory = "fabric" | "thread" | "accessory" | "machine_part";
export type InventoryUnit = "meter" | "roll" | "piece" | "kg";
export type InvoiceKind = "sale" | "purchase";
export type InvoiceSalesType = "PRODUCT_SALE" | "SERVICE";
export type PaymentType = "cash" | "deferred" | "partial";
export type InvoiceStatus = "paid" | "partial" | "unpaid";
export type VoucherType = "receipt" | "payment" | "deferred" | "journal";
export type PartyKind = "customer" | "supplier" | "other";
export type PaymentMethod = "cash" | "remittance" | "jeeb" | "e_wallet";
export type ExpenseKind = "work" | "personal";
export type DocumentType = "invoice" | "voucher" | "expense";

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

export const INVOICE_PREFIX: Record<InvoiceKind, string> = {
  sale: "INV",
  purchase: "PUR",
};

export const VOUCHER_PREFIX: Record<VoucherType, string> = {
  receipt: "REC",
  payment: "PAY",
  deferred: "JOU",
  journal: "JOU",
};

export const INVOICE_DESCRIPTION: Record<InvoiceKind | "service_sale", string> = {
  sale: "فاتورة مبيعات",
  purchase: "فاتورة مشتريات",
  service_sale: "فاتورة خدمة تطريز",
};

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
  type: CustomerType;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  balance: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  minQuantity: number;
  color: string;
  lastUpdated: string;
}

export interface InvoiceLine {
  id: string;
  inventoryItemId?: string;
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceKind;
  paymentType: PaymentType;
  invoiceType?: InvoiceSalesType;
  partyId: string;
  date: string;
  items: InvoiceLine[];
  subTotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  isApproved: boolean;
  notes?: string;
  createdAt: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  partyType: PartyKind;
  partyId?: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  description: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  documentId: string;
  documentNumber: string;
  documentType: DocumentType;
  partyId?: string;
  partyType?: PartyKind;
  debit: number;
  credit: number;
  cashIn: number;
  cashOut: number;
  paymentMethod?: PaymentMethod;
  description: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  type: ExpenseKind;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

export interface WorkshopSettings {
  name: string;
  location: string;
  phone1: string;
  phone2: string;
}

export interface AppData {
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  vouchers: Voucher[];
  transactions: Transaction[];
  expenses: Expense[];
  settings: WorkshopSettings;
}

export const DEFAULT_SETTINGS: WorkshopSettings = {
  name: "معامل هاشم الأحمدي للتصميم والتطريز",
  location: "صنعاء — شارع الزبيري — مقابل وزارة الدفاع",
  phone1: "770 447 441",
  phone2: "730 447 441",
};

export const EMPTY_DATA: AppData = {
  customers: [],
  suppliers: [],
  inventory: [],
  invoices: [],
  vouchers: [],
  transactions: [],
  expenses: [],
  settings: DEFAULT_SETTINGS,
};
