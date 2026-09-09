export type CustomerType = "retail" | "wholesale";
export type InventoryCategory = "fabric" | "thread" | "accessory" | "machine_part";
export type InventoryUnit = "meter" | "roll" | "piece" | "kg";
export type InvoiceKind = "sale" | "purchase";
export type InvoiceSalesType = "PRODUCT_SALE" | "SERVICE" | "ISSUE";
export type PaymentType = "cash" | "deferred" | "partial";
export type InvoiceStatus = "paid" | "partial" | "unpaid";
export type VoucherType = "receipt" | "payment" | "deferred" | "journal";
export type PartyKind = "customer" | "supplier" | "other";
export type PaymentMethod = "cash" | "remittance" | "jeeb" | "e_wallet";
export type ExpenseKind = "work" | "personal";
export type DocumentType = "invoice" | "voucher" | "expense";

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
  /** Preferred warehouse for opening stock / default issue source */
  warehouseId?: string;
  costPrice: number;
  sellingPrice: number;
  minQuantity: number;
  color: string;
  lastUpdated: string;
}

export interface WarehouseStockRow {
  warehouseId: string;
  productId: string;
  quantity: number;
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
  /** Warehouse that stock is taken from / received into for this document */
  warehouseId?: string;
  date: string;
  items: InvoiceLine[];
  subTotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: PaymentMethod;
  status: InvoiceStatus;
  isApproved: boolean;
  isCancelled?: boolean;
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


export interface OrganizationProfile {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  phone?: string;
  address?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  commercialNumber?: string;
  footerText?: string;
}

export interface WorkshopSettings {
  name: string;
  location: string;
  phone1: string;
  phone2: string;
}


export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AuditLogEntry {
  auditId: string;
  operationId?: string;
  entityType: string;
  entityId: string;
  action: string;
  deviceId?: string;
  createdAt: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
  status?: "success" | "failed" | "pending";
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
  organization: OrganizationProfile;
  warehouses: Warehouse[];
  productCategories: ProductCategory[];
  auditLog: AuditLogEntry[];
  warehouseStocks: WarehouseStockRow[];
  userPermissions?: string[];
  userId?: string;
  defaultWarehouseId: string;
}


export const DEFAULT_ORGANIZATION: OrganizationProfile = {
  id: 'default_org',
  name: "معامل هاشم الأحمدي للتصميم والتطريز",
  address: "صنعاء — شارع الزبيري — مقابل وزارة الدفاع",
  phone: "770 447 441 - 730 447 441",
};

export const DEFAULT_SETTINGS: WorkshopSettings = {
  name: "معامل هاشم الأحمدي للتصميم والتطريز",
  location: "صنعاء — شارع الزبيري — مقابل وزارة الدفاع",
  phone1: "770 447 441",
  phone2: "730 447 441",
};

export const EMPTY_DATA: AppData = {
  organization: DEFAULT_ORGANIZATION,
  customers: [],
  suppliers: [],
  inventory: [],
  invoices: [],
  vouchers: [],
  transactions: [],
  expenses: [],
  settings: DEFAULT_SETTINGS,
  warehouses: [
    { id: "wh1", name: "المخزن الرئيسي", location: "", isActive: true, createdAt: "2020-01-01T00:00:00.000Z" },
  ],
  productCategories: [
    { id: "fabric", name: "أقمشة", isActive: true },
    { id: "thread", name: "خيوط", isActive: true },
    { id: "accessory", name: "إكسسوارات", isActive: true },
    { id: "machine_part", name: "قطع آلات", isActive: true },
  ],
  auditLog: [],
  warehouseStocks: [],
  userPermissions: [],
  userId: undefined,
  defaultWarehouseId: "wh1",
};
