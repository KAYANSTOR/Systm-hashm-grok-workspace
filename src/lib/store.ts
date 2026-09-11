import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyExpense, applyInvoice, applyVoucher } from "./accounting";
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
import { fetchAllData, syncLegacyData, saveOrganization, addParty, updateParty, deleteParty, addProduct, updateProduct, deleteProduct, saveInvoice, deleteInvoiceApi, cancelInvoiceApi, saveVoucher, deleteVoucherApi, saveExpense, deleteExpenseApi, listAuditEvents } from "../server/repository";

let fetchInFlight = false;
let lastFetchAt = 0;

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
  connectionState: "online" | "offline" | "syncing";
  pendingSyncCount: number;
  lastSyncMessage: string;
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
      connectionState: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
      pendingSyncCount: 0,
      lastSyncMessage: "",
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
        // قفل ضد التشغيل المتوازي — ضغطة مزامنة يدوية مرتين كانت تشغّل drain مرتين معًا
        if ((get() as any).__drainInFlight) return;
        (get() as any).__drainInFlight = true;
        try {
        const drained = await drainOutbox(items, async (item) => {
          // Apply the idempotent business projection before recording the
          // operation claim.  Previously the claim was written first and the
          // mutation was sent in a second request: a disconnect in between
          // made a retry look like a duplicate and silently lost the change.
          // Each repository mutation is document-idempotent, so a retry in
          // this small pre-claim window safely converges to the same state.
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

          // The durable idempotency claim and audit event are written only
          // after the business transaction succeeded.  drainOutbox finalizes
          // this processing claim into the durable ACK in its next step.
          return await applyOutboxOperation({ data: item }) as any;
        });
        // احذف المنتهية والفاشلة المستنفدة حتى لا تبقى رسالة «عملية معلقة» للأبد
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

      /** تنظيف الطابور العالق يدويًا (عمليات فاشلة مستنفدة أو منتهية) */
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
        // امسح الإسقاط المحلي + الطابور حتى لا تُعاد مزامنة بيانات قديمة بعد التصفية
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
        // The persisted counter is only a display/status hint and may outlive
        // the queue after a successful drain. Never use it to replay a full
        // legacy snapshot; inspect the actual retryable operations instead.
        if (outboxPendingCount(get().outbox) > 0) return get().drainPendingOutbox();
        fetchInFlight = true;
        lastFetchAt = now;
        try {
        const data = await fetchAllData();

        // Auto-migration
        if (data.organization) set({ organization: data.organization });
        if (data.isDbEmpty && (get().invoices.length > 0 || get().customers.length > 0)) {
           console.log("Legacy data detected, syncing to database...");
           await get().syncLegacyDb();
           return;
        }

        const groupedTx: Record<string, any> = {};
        for (const t of (data.transactions || [])) {
          const docId = t.reference_id;
          if (!groupedTx[docId]) {
            groupedTx[docId] = {
              id: t.id.split('_')[0],
              date: t.created_at,
              documentId: docId,
              documentNumber: docId,
              documentType: t.reference_type === 'invoice' ? 'invoice' : t.reference_type === 'voucher' ? 'voucher' : 'expense',
              partyId: t.party_id,
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
              paymentMethod: inv.payment_method,
              isApproved: inv.is_approved,
              isCancelled: Boolean(inv.notes && String(inv.notes).includes("[CANCELLED]")),
              warehouseId: inv.warehouse_id || get().defaultWarehouseId || "wh1",
              createdAt: inv.created_at,
              items: (invoiceItemsByInvoice.get(inv.id) || []).map((item: any) => ({
                 ...item,
                 inventoryItemId: item.product_id,
                 unitPrice: Number(item.unit_price),
                 total: Number(item.total)
              }))
           })),
           vouchers: (data.vouchers || []).map((v: any) => ({
              ...v,
              voucherNumber: v.voucher_number,
              partyType: v.party_type,
              partyId: v.party_id,
              paymentMethod: v.payment_method,
              createdAt: v.created_at
           })),
           expenses: (data.expenses || []).map((e: any) => ({
              ...e,
              paymentMethod: e.payment_method,
              createdAt: e.created_at
           })),
           transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        });
        set({ connectionState: "online", pendingSyncCount: 0, lastSyncMessage: "تم تحديث البيانات من السحابة" });
          await get().refreshAuditFromServer();
        } finally {
          fetchInFlight = false;
        }
      },

      refreshAuditFromServer: async () => {
        try {
          const rows = await listAuditEvents();
          if (!Array.isArray(rows) || !rows.length) return;
          set((s) => {
            const byOp = new Map<string, any>();
            for (const e of s.auditLog || []) {
              const key = e.operationId || e.auditId;
              byOp.set(key, e);
            }
            for (const r of rows) {
              const operationId = r.operation_id || undefined;
              const auditId = r.audit_id;
              const key = operationId || auditId;
              const existing = byOp.get(key);
              const entry = {
                auditId,
                operationId,
                entityType: r.entity_type,
                entityId: r.entity_id,
                action: r.action,
                deviceId: r.device_id || undefined,
                createdAt: r.created_at || new Date().toISOString(),
                summary: `${r.action} · ${r.entity_type}`,
                before: r.before_data,
                after: r.after_data,
                status: "success" as const,
              };
              // Prefer server row when same operation_id
              byOp.set(key, existing && !operationId ? existing : entry);
            }
            const merged = [...byOp.values()].sort((a, b) =>
              String(b.createdAt).localeCompare(String(a.createdAt)),
            );
            return { auditLog: merged.slice(0, 500) };
          });
        } catch (e) {
          console.error("refreshAuditFromServer", e);
        }
      },

      syncLegacyDb: async () => {
        if (syncPromise) return syncPromise;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          set({ connectionState: "offline", pendingSyncCount: 1, lastSyncMessage: "تم حفظ العمليات على الجهاز، وستُرحّل عند عودة الإنترنت" });
          return;
        }
        set({ connectionState: "syncing", pendingSyncCount: 1, lastSyncMessage: "جارٍ ترحيل العمليات إلى السحابة…" });
        const s = get();
        syncPromise = syncLegacyData({ data: {
          customers: s.customers,
          suppliers: s.suppliers,
          inventory: s.inventory,
          invoices: s.invoices,
          vouchers: s.vouchers,
          transactions: s.transactions,
          expenses: s.expenses,
          settings: s.settings,
          organization: s.organization,
          warehouses: s.warehouses,
          productCategories: s.productCategories
        }}).then(async () => {
          set({ connectionState: "online", pendingSyncCount: 0, lastSyncMessage: "تم ترحيل البيانات إلى السحابة بنجاح" });
          lastFetchAt = 0;
          await get().fetchFromDb();
        }).catch((error) => {
          set({ connectionState: "offline", pendingSyncCount: 1, lastSyncMessage: syncErrorMessage(error) });
          throw error;
        }).finally(() => { syncPromise = null; });
        return syncPromise;

      },

      importData: (data) =>
        set({
          customers: data.customers ?? [],
          suppliers: data.suppliers ?? [],
          inventory: data.inventory ?? [],
          invoices: data.invoices ?? [],
          vouchers: data.vouchers ?? [],
          transactions: data.transactions ?? [],
          expenses: data.expenses ?? [],
          settings: { ...EMPTY_DATA.settings, ...data.settings },
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateOrganization: (patch) => {
        set((s) => ({ organization: { ...s.organization, ...patch } }));
        saveOrganization({ data: get().organization }).catch(console.error);
      },


      addCustomer: (c) => {
        const id = uid("c");
        const createdAt = new Date().toISOString();
        const customer = { ...c, id, createdAt };
        const result = mutateUpsertCustomer(get() as any, customer, true);
        applyBundle(get, set, result, "تعذر حفظ العميل على الخادم");
        return id;
      },

      updateCustomer: (id, data) => {
        const prev = get().customers.find((c) => c.id === id);
        if (!prev) return;
        const customer = { ...prev, ...data, id };
        applyBundle(get, set, mutateUpsertCustomer(get() as any, customer, false), "تعذر تحديث العميل");
      },

      deleteCustomer: (id) => {
        applyBundle(get, set, mutateDeleteParty(get() as any, id, "customer"), "تعذر حذف العميل");
      },

      addSupplier: (sup) => {
        const id = uid("s");
        const createdAt = new Date().toISOString();
        const supplier = { ...sup, id, createdAt };
        applyBundle(get, set, mutateUpsertSupplier(get() as any, supplier, true), "تعذر حفظ المورد على الخادم");
        return id;
      },

      updateSupplier: (id, data) => {
        const prev = get().suppliers.find((x) => x.id === id);
        if (!prev) return;
        const supplier = { ...prev, ...data, id };
        applyBundle(get, set, mutateUpsertSupplier(get() as any, supplier, false), "تعذر تحديث المورد");
      },

      deleteSupplier: (id) => {
        applyBundle(get, set, mutateDeleteParty(get() as any, id, "supplier"), "تعذر حذف المورد");
      },

      addInventoryItem: (i) => {
        const id = uid("i");
        const lastUpdated = new Date().toISOString();
        const item = { ...i, id, lastUpdated };
        applyBundle(get, set, mutateUpsertProduct(get() as any, item, true), "تعذر حفظ المادة على الخادم");
        return id;
      },

      updateInventoryItem: (id, data) => {
        const prev = get().inventory.find((x) => x.id === id);
        if (!prev) return;
        const item = { ...prev, ...data, id, lastUpdated: new Date().toISOString() };
        applyBundle(get, set, mutateUpsertProduct(get() as any, item, false), "تعذر تحديث المادة");
      },

      deleteInventoryItem: (id) => {
        applyBundle(get, set, mutateDeleteProduct(get() as any, id), "تعذر حذف المادة");
      },

      addInvoice: (i) => {
        const id = uid("inv");
        const invoice = { ...i, id, createdAt: new Date().toISOString() };
        const result = mutateSaveInvoice(get() as any, invoice);
        const ok = applyBundle(get, set, result, "تعذر حفظ الفاتورة");
        return ok ? id : "";
      },

      updateInvoice: (id, data) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated = { ...old, ...data, id };
        applyBundle(get, set, mutateSaveInvoice(get() as any, updated, old), "تعذر تحديث الفاتورة");
      },

      deleteInvoice: (id) => {
        applyBundle(get, set, mutateDeleteInvoice(get() as any, id), "تعذر حذف الفاتورة");
      },

      approveInvoice: (id) => {
        return applyBundle(get, set, mutateApproveInvoice(get() as any, id), "تعذر اعتماد الفاتورة");
      },

      cancelInvoice: (id) => {
        return applyBundle(get, set, mutateCancelInvoice(get() as any, id), "تعذر إلغاء الفاتورة");
      },

      addVoucher: (v) => {
        const id = uid("v");
        const voucher = { ...v, id, createdAt: new Date().toISOString() };
        applyBundle(get, set, mutateSaveVoucher(get() as any, voucher), "تعذر حفظ السند");
        return id;
      },

      deleteVoucher: (id) => {
        applyBundle(get, set, mutateDeleteVoucher(get() as any, id), "تعذر حذف السند");
      },

      addExpense: (e) => {
        const id = uid("e");
        const expense = { ...e, id, createdAt: new Date().toISOString() };
        applyBundle(get, set, mutateSaveExpense(get() as any, expense), "تعذر حفظ المصروف");
        return id;
      },

      deleteExpense: (id) => {
        applyBundle(get, set, mutateDeleteExpense(get() as any, id), "تعذر حذف المصروف");
      },


      addWarehouse: (w) => {
        const id = uid("wh");
        const row = {
          id,
          name: w.name.trim(),
          location: w.location || "",
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          warehouses: [row, ...(s.warehouses || [])],
          auditLog: [
            {
              auditId: uid("aud"),
              entityType: "warehouse",
              entityId: id,
              action: "create",
              createdAt: new Date().toISOString(),
              summary: `إنشاء مخزن · ${row.name}`,
              status: "success" as const,
            },
            ...(s.auditLog || []),
          ].slice(0, 500),
        }));
        return id;
      },
      updateWarehouse: (id, data) => {
        set((s) => ({
          warehouses: (s.warehouses || []).map((x) =>
            x.id === id ? { ...x, ...data } : x,
          ),
        }));
      },
      addProductCategory: (name) => {
        const id = uid("cat");
        const row = { id, name: name.trim(), isActive: true };
        set((s) => ({
          productCategories: [row, ...(s.productCategories || [])],
          auditLog: [
            {
              auditId: uid("aud"),
              entityType: "category",
              entityId: id,
              action: "create",
              createdAt: new Date().toISOString(),
              summary: `إنشاء فئة · ${row.name}`,
              status: "success" as const,
            },
            ...(s.auditLog || []),
          ].slice(0, 500),
        }));
        return id;
      },
      updateProductCategory: (id, data) => {
        set((s) => {
          const cats = s.productCategories || [];
          const cat = cats.find((c) => c.id === id);
          if (data.isActive === false) {
            const used = s.inventory.some((i) => i.category === id || i.category === cat?.name);
            if (used) {
              try { toast.error("لا يمكن تعطيل فئة مرتبطة بأصناف — عطّل الأصناف أولاً أو أبقِ الفئة"); } catch { /* Toast is optional during SSR. */ }
              return s;
            }
          }
          return {
            productCategories: cats.map((c) => (c.id === id ? { ...c, ...data } : c)),
          };
        });
      },

    }),
    {
      name: "hashem-workshop-v2",
      skipHydration: true,
      partialize: (s) => ({
        customers: s.customers,
        suppliers: s.suppliers,
        inventory: s.inventory,
        invoices: s.invoices,
        vouchers: s.vouchers,
        transactions: s.transactions,
        expenses: s.expenses,
        settings: s.settings,
        organization: s.organization,
        warehouses: s.warehouses,
        productCategories: s.productCategories,
        auditLog: s.auditLog,
        warehouseStocks: s.warehouseStocks,
        userPermissions: s.userPermissions,
        userId: s.userId,
        defaultWarehouseId: s.defaultWarehouseId,
        connectionState: s.connectionState,
        pendingSyncCount: s.pendingSyncCount,
        lastSyncMessage: s.lastSyncMessage,
        outbox: s.outbox,
      }),
    }
  )
);


if (typeof window !== "undefined") {
  let syncTimeout: any = null;
  const debouncedSync = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      if (!navigator.onLine) return;
      const state = useStore.getState();
      if (outboxPendingCount(state.outbox) > 0) {
        state.drainPendingOutbox().catch(console.error);
      }
    }, 2000);
  };

  useStore.persist.onFinishHydration((state) => {
      // نظّف الطابور من عناصر done/فاشلة مستنفدة فور الاستعادة من التخزين المحلي
      try {
        state.clearStuckOutbox();
      } catch {
        /* ignore */
      }
      // Always refresh from the shared database after hydration. Previously
      // this only happened when local storage was empty, so a manager with an
      // older local cache could never see a receipt submitted by the receiver.
      if (navigator.onLine) state.fetchFromDb().catch(console.error);
  });

  useStore.persist.rehydrate();

  useStore.subscribe((state, prevState) => {
      // Basic check if data changed
      if (
         state.customers !== prevState.customers ||
         state.invoices !== prevState.invoices ||
         state.inventory !== prevState.inventory ||
         state.vouchers !== prevState.vouchers ||
         state.expenses !== prevState.expenses
      ) {
         // A server refresh also changes these references. Only local
         // operations represented in the retryable outbox may schedule a
         // drain; otherwise every refresh would upload the whole snapshot
         // again and again.
         const pending = outboxPendingCount(state.outbox);
         if (pending > 0) {
           useStore.setState({
             pendingSyncCount: pending,
             connectionState: navigator.onLine ? "syncing" : "offline",
           });
           debouncedSync();
         }
      }
  });

  window.addEventListener('online', () => {
    debouncedSync();
    useStore.getState().drainPendingOutbox().catch(console.error);
  });
  window.addEventListener('focus', () => {
    if (navigator.onLine) useStore.getState().fetchFromDb().catch(console.error);
  });
}
