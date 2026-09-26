import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { approveInvoiceOp, issueMaterialOp } from "../domain/operations.ts";
import { ERROR_MESSAGES_AR } from "../domain/result.ts";
import { ledgerRowId } from "../domain/idempotency.ts";
import {
  mutateApproveInvoice,
  mutateSaveInvoice,
  mutateDeleteInvoice,
  mutateCancelInvoice,
  mutateSaveVoucher,
  mutateDeleteVoucher,
  mutateSaveExpense,
  mutateDeleteExpense,
  mutateUpsertCustomer,
  mutateUpsertSupplier,
  mutateDeleteParty,
  mutateUpsertProduct,
  mutateDeleteProduct,
  mutateIssueMaterial,
} from "../application/mutate.ts";
import type { OutboxItem } from "../domain/outbox.ts";
import { pruneSettledOutbox } from "../domain/outbox.ts";
import { drainOutbox, outboxPendingCount } from "../application/sync-engine.ts";
import { applyOutboxOperation } from "../server/repository";
import { getDeviceId } from "../domain/device.ts";
import { EMPTY_DATA } from "./types";
import type { AppData, Customer, Expense, InventoryItem, Invoice, Supplier, Voucher, WorkshopSettings, OrganizationProfile } from "./types";
import { uid } from "./utils";
import { hydrateInvoiceLine } from "@/lib/embroidery";
import { fetchAllData, syncLegacyData, saveOrganization, addParty, updateParty, deleteParty, addProduct, updateProduct, deleteProduct, saveInvoice, deleteInvoiceApi, cancelInvoiceApi, saveVoucher, deleteVoucherApi, saveExpense, deleteExpenseApi, listAuditEvents } from "../server/repository";

let fetchInFlight = false;
let lastFetchAt = 0;

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("SYNC_TIMEOUT")), milliseconds);
    }),
  ]);
}

/** يسمح بإعادة الجلب فورًا بعد مزامنة يدوية (يتجاوز throttle الـ 15 ثانية). */
export function forceAllowFetch() {
  lastFetchAt = 0;
  fetchInFlight = false;
}
let syncPromise: Promise<void> | null = null;

function serverFail(userMessage: string, err: unknown) {
  console.error(userMessage, err);
  try { toast.error(userMessage); } catch { /* SSR */ }
}

export function syncErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/Unauthorized|401/i.test(message)) return "انتهت جلسة الدخول. سجّل الدخول ثم أعد المزامنة.";
  if (/Forbidden|sync\.write|settings\.write|403/i.test(message)) return "حسابك لا يملك صلاحية مزامنة البيانات. اطلب من مدير النظام تفعيل صلاحية المزامنة.";
  if (/Failed to fetch|NetworkError|offline|ERR_NETWORK/i.test(message)) return "تعذر الوصول إلى السحابة. تحقق من الإنترنت ثم أعد المحاولة.";
  if (/INSUFFICIENT_STOCK/i.test(message)) return "تعذر استيراد حركة قديمة بسبب فحص المخزون. أعد المحاولة بعد تحديث التطبيق.";
  return message && message.length < 180 ? `فشلت المزامنة: ${message}` : "فشلت المزامنة بسبب خطأ غير متوقع. راجع سجل الخادم.";
}

function applyBundle(get: any, set: any, result: any, failMsg: string) {
  if (!result.ok) {
    try {
      const code = result.error.code as keyof typeof ERROR_MESSAGES_AR;
      toast.error(result.error.message || ERROR_MESSAGES_AR[code]);
    } catch {
      // Toast is optional during SSR.
    }
    return false;
  }
  const audit = result.value.audit;
  set((s: any) => {
    const next = { ...(result.value.state as any) };
    if (audit) {
      const entry = {
        auditId: audit.auditId,
        operationId: audit.operationId,
        entityType: audit.entityType,
        entityId: audit.entityId,
        action: audit.action,
        deviceId: audit.deviceId,
        createdAt: audit.createdAt || new Date().toISOString(),
        summary: `${audit.action} · ${audit.entityType}`,
        before: audit.before,
        after: audit.after,
        status: "success" as const,
      };
      next.auditLog = [entry, ...(s.auditLog || [])].slice(0, 500);
    }
    return next;
  });
  get().enqueueOutbox(result.value.outbox);
  (async () => {
    try { await get().drainPendingOutbox(); }
    catch (e) { serverFail(failMsg, e); }
  })();
  return true;
}


type Store = AppData & {
  permissionsLoaded: boolean;
  connectionState: "online" | "offline" | "syncing";
  pendingSyncCount: number;
  lastSyncMessage: string;
  initialDataLoaded: boolean;
  outbox: OutboxItem[];
  enqueueOutbox: (item: OutboxItem) => void;
  drainPendingOutbox: () => Promise<void>;
  clearStuckOutbox: () => void;
  fetchFromDb: () => Promise<void>;
  refreshAuditFromServer: () => Promise<void>;
  syncLegacyDb: () => Promise<void>;
  resetDemo: () => void;
  resetDatabase: () => Promise<void>;
  importData: (data: AppData) => void;
  updateSettings: (patch: Partial<WorkshopSettings>) => void;
  updateOrganization: (patch: Partial<OrganizationProfile>) => void;
  addCustomer: (c: Omit<Customer, "id" | "createdAt">) => string;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (s: Omit<Supplier, "id" | "createdAt">) => string;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addInventoryItem: (i: Omit<InventoryItem, "id" | "lastUpdated">) => string;
  updateInventoryItem: (id: string, data: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  addInvoice: (i: Omit<Invoice, "id" | "createdAt">) => string;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  approveInvoice: (id: string) => boolean;
  cancelInvoice: (id: string) => boolean;
  addWarehouse: (w: { name: string; location?: string }) => string;
  updateWarehouse: (id: string, data: Partial<{ name: string; location: string; isActive: boolean }>) => void;
  addProductCategory: (name: string) => string;
  updateProductCategory: (id: string, data: Partial<{ name: string; isActive: boolean }>) => void;
  addVoucher: (v: Omit<Voucher, "id" | "createdAt">) => string;
  deleteVoucher: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => string;
  deleteExpense: (id: string) => void;
};

import { resetDatabase as resetDbApi } from "../server/repository";
export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...EMPTY_DATA,
      permissionsLoaded: false,
      connectionState: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
      pendingSyncCount: 0,
      lastSyncMessage: "",
      initialDataLoaded: false,
      outbox: [],
      enqueueOutbox: (item) =>
        set((s) => ({
          outbox: [...s.outbox.filter((x) => x.operationId !== item.operationId), item],
          pendingSyncCount: Math.max(1, s.pendingSyncCount),
        })),
      drainPendingOutbox: async () => {
        const items = get().outbox;
        if (!items.length) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          set({ connectionState: "offline", lastSyncMessage: "العمليات محفوظة محليًا وبانتظار الاتصال" });
          return;
        }
        if ((get() as any).__drainInFlight) return;
        (get() as any).__drainInFlight = true;
        try {
        const drained = await drainOutbox(items, async (item) => {
          const p = item.payload as any;
          if (item.operationType === "invoice.save" || item.operationType === "invoice.approve") {
            await saveInvoice({ data: p });
          } else if (item.operationType === "invoice.cancel") {
            await cancelInvoiceApi({ data: { id: p?.id || item.documentId } });
          } else if (item.operationType === "invoice.delete") {
            await deleteInvoiceApi({ data: { id: p?.id || item.documentId } });
          } else if (item.operationType === "voucher.save") {
            await saveVoucher({ data: p });
          } else if (item.operationType === "voucher.delete") {
            await deleteVoucherApi({ data: { id: p?.id || item.documentId } });
          } else if (item.operationType === "expense.save") {
            await saveExpense({ data: p });
          } else if (item.operationType === "expense.delete") {
            await deleteExpenseApi({ data: { id: p?.id || item.documentId } });
          } else if (item.operationType === "party.upsert" || item.operationType === "opening.balance") {
            await addParty({ data: p });
          } else if (item.operationType === "party.delete") {
            await deleteParty({ data: { id: p?.id || item.documentId } });
          } else if (item.operationType === "product.upsert" || item.operationType === "opening.stock") {
            await addProduct({ data: p });
          } else if (item.operationType === "product.delete") {
            await deleteProduct({ data: { id: p?.id || item.documentId } });
          }

          return await applyOutboxOperation({ data: item }) as any;
        });
        const remaining = pruneSettledOutbox(drained);
        const pending = outboxPendingCount(remaining);
        set({
          outbox: remaining,
          pendingSyncCount: pending,
          connectionState: pending > 0 ? "syncing" : (typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"),
          lastSyncMessage: pending > 0 ? "بعض العمليات بانتظار الترحيل" : "تمت مزامنة العمليات",
        });
        } finally {
          (get() as any).__drainInFlight = false;
        }
      },

      clearStuckOutbox: () => {
        const remaining = pruneSettledOutbox(get().outbox || []);
        const pending = outboxPendingCount(remaining);
        set({
          outbox: remaining,
          pendingSyncCount: pending,
          connectionState: pending > 0
            ? "syncing"
            : (typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"),
          lastSyncMessage: pending > 0 ? "لا تزال هناك عمليات قابلة لإعادة المحاولة" : "تم تنظيف الطابور — لا عمليات معلقة",
        });
      },

      resetDemo: () => set({ ...EMPTY_DATA }),
      resetDatabase: async () => {
        await resetDbApi();
        set({
          ...EMPTY_DATA,
          outbox: [],
          pendingSyncCount: 0,
          connectionState: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
          lastSyncMessage: "تم تصفير بيانات العمل على الخادم والجهاز",
        });
        lastFetchAt = 0;
        forceAllowFetch();
        await get().fetchFromDb();
      },

      fetchFromDb: async () => {
        const now = Date.now();
        if (fetchInFlight || now - lastFetchAt < 15_000) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          set({ connectionState: "offline", lastSyncMessage: "أنت غير متصل — يتم عرض البيانات المحفوظة على الجهاز" });
          return;
        }
        if (outboxPendingCount(get().outbox) > 0) {
          return withTimeout(get().drainPendingOutbox(), 7000).catch(() => {
            set({ connectionState: "offline", lastSyncMessage: "تعذر الاتصال الآن — البيانات المحلية متاحة" });
          });
        }
        fetchInFlight = true;
        lastFetchAt = now;
        try {
        const data = await withTimeout(fetchAllData(), 8000);

        if (data.organization) set({ organization: data.organization });
        if (data.isDbEmpty && (get().invoices.length > 0 || get().customers.length > 0)) {
           console.log("Legacy data detected, syncing to database...");
           await get().syncLegacyDb();
           return;
        }

        const methodByDoc = new Map<string, string>();
        const numberByDoc = new Map<string, string>();
        for (const doc of [
          ...(data.invoices || []),
          ...(data.vouchers || []),
          ...(data.expenses || []),
        ] as any[]) {
          if (doc.paymentMethod || doc.payment_method) {
            methodByDoc.set(doc.id, "cash");
          }
          const number = doc.invoiceNumber || doc.invoice_number || doc.voucherNumber || doc.voucher_number;
          if (number) numberByDoc.set(doc.id, String(number));
        }
        const documentTypeOf = (referenceType: string) =>
          referenceType === 'invoice' || referenceType === 'invoice_payment'
            ? 'invoice'
            : referenceType === 'voucher'
              ? 'voucher'
              : 'expense';

        const groupedTx: Record<string, any> = {};
        for (const t of (data.transactions || [])) {
          const docId = t.reference_id;
          if (!groupedTx[docId]) {
            groupedTx[docId] = {
              id: t.id.split('_')[0],
              date: t.created_at,
              documentId: docId,
              documentNumber: numberByDoc.get(docId) || docId,
              documentType: documentTypeOf(t.reference_type),
              partyId: t.party_id,
              paymentMethod: methodByDoc.get(docId) || 'cash',
              debit: 0,
              credit: 0,
              cashIn: 0,
              cashOut: 0,
              description: t.description
            };
          }
          const g = groupedTx[docId];
          if (t.account_id === 'cash') {
            g.cashIn += Number(t.debit) || 0;
            g.cashOut += Number(t.credit) || 0;
          } else {
            g.debit += Number(t.debit) || 0;
            g.credit += Number(t.credit) || 0;
          }
          const isDocumentRow = String(t.id || '').endsWith('_party');
          if (isDocumentRow) {
            g.documentType = documentTypeOf(t.reference_type);
            g.documentNumber = numberByDoc.get(docId) || g.documentNumber;
            g.partyId = t.party_id || g.partyId;
            if (t.description) g.description = t.description;
          }
        }
        const transactions = Object.values(groupedTx) as any[];
        const partyBalances = new Map<string, number>();
        for (const transaction of transactions) {
          if (!transaction.partyId) continue;
          partyBalances.set(
            transaction.partyId,
            (partyBalances.get(transaction.partyId) || 0) + transaction.debit - transaction.credit,
          );
        }
        const invoiceItemsByInvoice = new Map<string, any[]>();
        for (const item of data.invoiceItems || []) {
          const items = invoiceItemsByInvoice.get(item.invoice_id) || [];
          items.push(item);
          invoiceItemsByInvoice.set(item.invoice_id, items);
        }

        set({
           customers: (data.parties || []).filter((p: any) => p.type === 'customer' || p.type === 'retail' || p.type === 'wholesale').map((c: any) => ({
             ...c,
             balance: partyBalances.get(c.id) || 0,
           })),
           suppliers: (data.parties || []).filter((p: any) => p.type === 'supplier').map((s: any) => ({
             ...s,
             balance: -(partyBalances.get(s.id) || 0),
           })),
           warehouseStocks: (data.stock || []).map((s: any) => ({
             warehouseId: s.warehouse_id,
             productId: s.product_id,
             quantity: Number(s.quantity) || 0,
           })),
           warehouses: (data.warehouses || []).length
             ? (data.warehouses || []).map((w: any) => ({
                 id: w.id,
                 name: w.name,
                 location: w.location || "",
                 isActive: w.is_active !== false,
                 createdAt: w.created_at || new Date().toISOString(),
               }))
             : get().warehouses,
           defaultWarehouseId: get().defaultWarehouseId || "wh1",
          userPermissions: data.userPermissions || [],
          permissionsLoaded: true,
          userId: data.userId,
           inventory: (data.products || []).map((p: any) => {
             const rows = (data.stock || []).filter((s: any) => s.product_id === p.id);
             const qty = rows.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
             return {
               ...p,
               quantity: qty,
               warehouseId: rows[0]?.warehouse_id || get().defaultWarehouseId || "wh1",
               costPrice: Number(p.cost_price),
               sellingPrice: Number(p.selling_price),
               minQuantity: Number(p.min_stock),
             };
           }),
           invoices: (data.invoices || []).map((inv: any) => ({
              ...inv,
              invoiceNumber: inv.invoice_number,
              invoiceType: inv.invoice_type,
              partyId: inv.party_id,
              subTotal: Number(inv.sub_total),
              paidAmount: Number(inv.paid_amount),
              remainingAmount: Number(inv.remaining_amount),
              paymentType: inv.payment_type,
              paymentMethod: "cash",
              isApproved: inv.is_approved,
              isCancelled: Boolean(inv.notes && String(inv.notes).includes("[CANCELLED]")),
              warehouseId: inv.warehouse_id || get().defaultWarehouseId || "wh1",
              createdAt: inv.created_at,
              items: (invoiceItemsByInvoice.get(inv.id) || []).map((item: any) =>
                hydrateInvoiceLine(
                  {
                    id: item.id,
                    inventoryItemId: item.product_id || undefined,
                    name: item.name,
                    description: item.description || undefined,
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit || undefined,
                    unitPrice: Number(item.unit_price) || 0,
                    total: Number(item.total) || 0,
                    serviceUnit: item.service_unit || undefined,
                    serviceQuantity: item.service_quantity != null ? Number(item.service_quantity) : undefined,
                    serviceUnitPrice: item.service_unit_price != null ? Number(item.service_unit_price) : undefined,
                  },
                  inv.invoice_type === "SERVICE" || item.product_id === "SERVICE" || !item.product_id,
                ),
              )
           })),
           vouchers: (data.vouchers || []).map((v: any) => ({
              ...v,
              voucherNumber: v.voucher_number,
              partyType: v.party_type,
              partyId: v.party_id,
              paymentMethod: "cash",
              createdAt: v.created_at
           })),
           expenses: (data.expenses || []).map((e: any) => ({
              ...e,
              paymentMethod: "cash",
              createdAt: e.created_at
           })),
           transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
           connectionState: "online",
           lastSyncMessage: "تم تحديث البيانات من السحابة",
           initialDataLoaded: true,
        });
        } catch (error) {
          console.warn("cloud snapshot skipped", error);
          set({
            connectionState: "offline",
            lastSyncMessage: syncErrorMessage(error),
            permissionsLoaded: true,
            initialDataLoaded: true,
          });
        } finally {
          fetchInFlight = false;
        }
      },

      refreshAuditFromServer: async () => {
        try {
          const events = await listAuditEvents();
          if (Array.isArray(events)) {
            set({ auditLog: events as any });
          }
        } catch (e) {
          console.warn("audit refresh failed", e);
        }
      },

      syncLegacyDb: async () => {
        if (syncPromise) return syncPromise;
        syncPromise = (async () => {
          try {
            set({ connectionState: "syncing", lastSyncMessage: "جاري رفع البيانات المحلية…" });
            await syncLegacyData({
              customers: get().customers,
              suppliers: get().suppliers,
              inventory: get().inventory,
              invoices: get().invoices,
              vouchers: get().vouchers,
              expenses: get().expenses,
              transactions: get().transactions,
              organization: get().organization,
              warehouses: get().warehouses,
              warehouseStocks: get().warehouseStocks,
            } as any);
            set({ lastSyncMessage: "اكتمل رفع البيانات المحلية" });
            forceAllowFetch();
            await get().fetchFromDb();
          } catch (e) {
            serverFail("فشل رفع البيانات المحلية", e);
            set({ connectionState: "offline", lastSyncMessage: syncErrorMessage(e) });
          } finally {
            syncPromise = null;
          }
        })();
        return syncPromise;
      },

      importData: (data) => set({ ...data }),

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      updateOrganization: async (patch) => {
        const next = { ...get().organization, ...patch };
        set({ organization: next });
        try {
          await saveOrganization({ data: next });
        } catch (e) {
          serverFail("تعذر حفظ بيانات المنشأة", e);
        }
      },

      addCustomer: (c) => {
        const id = uid("c");
        const result = mutateUpsertCustomer(get(), { ...c, id, createdAt: new Date().toISOString() } as Customer, getDeviceId());
        applyBundle(get, set, result, "تعذر حفظ العميل");
        return id;
      },
      updateCustomer: (id, data) => {
        const current = get().customers.find((x) => x.id === id);
        if (!current) return;
        const result = mutateUpsertCustomer(get(), { ...current, ...data }, getDeviceId());
        applyBundle(get, set, result, "تعذر تحديث العميل");
      },
      deleteCustomer: (id) => {
        const result = mutateDeleteParty(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف العميل");
      },

      addSupplier: (s) => {
        const id = uid("s");
        const result = mutateUpsertSupplier(get(), { ...s, id, createdAt: new Date().toISOString() } as Supplier, getDeviceId());
        applyBundle(get, set, result, "تعذر حفظ المورد");
        return id;
      },
      updateSupplier: (id, data) => {
        const current = get().suppliers.find((x) => x.id === id);
        if (!current) return;
        const result = mutateUpsertSupplier(get(), { ...current, ...data }, getDeviceId());
        applyBundle(get, set, result, "تعذر تحديث المورد");
      },
      deleteSupplier: (id) => {
        const result = mutateDeleteParty(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف المورد");
      },

      addInventoryItem: (i) => {
        const id = uid("p");
        const result = mutateUpsertProduct(get(), { ...i, id, lastUpdated: new Date().toISOString() } as InventoryItem, getDeviceId());
        applyBundle(get, set, result, "تعذر حفظ الصنف");
        return id;
      },
      updateInventoryItem: (id, data) => {
        const current = get().inventory.find((x) => x.id === id);
        if (!current) return;
        const result = mutateUpsertProduct(get(), { ...current, ...data, lastUpdated: new Date().toISOString() }, getDeviceId());
        applyBundle(get, set, result, "تعذر تحديث الصنف");
      },
      deleteInventoryItem: (id) => {
        const result = mutateDeleteProduct(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف الصنف");
      },

      addInvoice: (i) => {
        const id = uid("inv");
        const inv = { ...i, id, createdAt: new Date().toISOString() } as Invoice;
        const result = mutateSaveInvoice(get(), inv, getDeviceId());
        if (!applyBundle(get, set, result, "تعذر حفظ الفاتورة")) return "";
        return id;
      },
      updateInvoice: (id, data) => {
        const current = get().invoices.find((x) => x.id === id);
        if (!current) return;
        const result = mutateSaveInvoice(get(), { ...current, ...data }, getDeviceId());
        applyBundle(get, set, result, "تعذر تحديث الفاتورة");
      },
      deleteInvoice: (id) => {
        const result = mutateDeleteInvoice(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف الفاتورة");
      },
      approveInvoice: (id) => {
        const result = mutateApproveInvoice(get(), id, getDeviceId());
        return applyBundle(get, set, result, "تعذر اعتماد الفاتورة");
      },
      cancelInvoice: (id) => {
        const result = mutateCancelInvoice(get(), id, getDeviceId());
        return applyBundle(get, set, result, "تعذر إلغاء الفاتورة");
      },

      addWarehouse: (w) => {
        const id = uid("wh");
        set((s) => ({
          warehouses: [
            ...s.warehouses,
            { id, name: w.name, location: w.location || "", isActive: true, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      updateWarehouse: (id, data) => {
        set((s) => ({
          warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, ...data } : w)),
        }));
      },
      addProductCategory: (name) => {
        const id = uid("cat");
        set((s) => ({
          productCategories: [...s.productCategories, { id, name, isActive: true }],
        }));
        return id;
      },
      updateProductCategory: (id, data) => {
        set((s) => ({
          productCategories: s.productCategories.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
      },

      addVoucher: (v) => {
        const id = uid("v");
        const result = mutateSaveVoucher(get(), { ...v, id, createdAt: new Date().toISOString() } as Voucher, getDeviceId());
        if (!applyBundle(get, set, result, "تعذر حفظ السند")) return "";
        return id;
      },
      deleteVoucher: (id) => {
        const result = mutateDeleteVoucher(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف السند");
      },

      addExpense: (e) => {
        const id = uid("e");
        const result = mutateSaveExpense(get(), { ...e, id, createdAt: new Date().toISOString() } as Expense, getDeviceId());
        if (!applyBundle(get, set, result, "تعذر حفظ المصروف")) return "";
        return id;
      },
      deleteExpense: (id) => {
        const result = mutateDeleteExpense(get(), id, getDeviceId());
        applyBundle(get, set, result, "تعذر حذف المصروف");
      },
    }),
    {
      name: "hashm-app-data",
      partialize: (s) => {
        const {
          permissionsLoaded,
          connectionState,
          pendingSyncCount,
          lastSyncMessage,
          initialDataLoaded,
          outbox,
          ...data
        } = s as any;
        return data;
      },
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    useStore.setState({ connectionState: "online" });
    useStore.getState().drainPendingOutbox().catch(console.error);
  });
  window.addEventListener("offline", () => {
    useStore.setState({ connectionState: "offline", lastSyncMessage: "انقطع الاتصال — العمل محليًا" });
  });
  if (navigator.onLine) {
    setTimeout(() => {
      useStore.getState().fetchFromDb().catch(console.error);
      useStore.getState().drainPendingOutbox().catch(console.error);
    }, 500);
  }
}
