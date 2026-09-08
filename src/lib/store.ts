import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyExpense, applyInvoice, applyVoucher } from "./accounting";
import { EMPTY_DATA } from "./types";
import type { AppData, Customer, Expense, InventoryItem, Invoice, Supplier, Voucher, WorkshopSettings, OrganizationProfile } from "./types";
import { uid } from "./utils";
import { fetchAllData, syncLegacyData, saveOrganization, addParty, updateParty, deleteParty, addProduct, updateProduct, deleteProduct, saveInvoice, deleteInvoiceApi, saveVoucher, deleteVoucherApi, saveExpense, deleteExpenseApi } from "../server/repository";

let fetchInFlight = false;
let lastFetchAt = 0;
let syncPromise: Promise<void> | null = null;

type Store = AppData & {
  connectionState: "online" | "offline" | "syncing";
  pendingSyncCount: number;
  lastSyncMessage: string;
  fetchFromDb: () => Promise<void>;
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
  approveInvoice: (id: string) => void;
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
      
      resetDemo: () => set({ ...EMPTY_DATA }),
      resetDatabase: async () => {
        await resetDbApi();
        set({ ...EMPTY_DATA });
        lastFetchAt = 0;
        await get().fetchFromDb();
      },
      
      fetchFromDb: async () => {
        const now = Date.now();
        if (fetchInFlight || now - lastFetchAt < 15_000) return;
        if (get().pendingSyncCount > 0) return get().syncLegacyDb();
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
           inventory: (data.products || []).map((p: any) => ({ ...p, quantity: Number((data.stock || []).find((s: any) => s.product_id === p.id)?.quantity || 0), costPrice: Number(p.cost_price), sellingPrice: Number(p.selling_price), minQuantity: Number(p.min_stock) })),
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
        } finally {
          fetchInFlight = false;
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
          settings: s.settings
        }}).then(() => {
          set({ connectionState: "online", pendingSyncCount: 0, lastSyncMessage: "تم ترحيل البيانات إلى السحابة بنجاح" });
        }).catch((error) => {
          set({ connectionState: "offline", pendingSyncCount: 1, lastSyncMessage: "تعذّر الترحيل مؤقتًا، ستتم إعادة المحاولة تلقائيًا" });
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
        const obj = { ...c, id, createdAt: new Date().toISOString() };
        set((s) => ({ customers: [obj, ...s.customers] }));
        
        return id;
      },
      
      updateCustomer: (id, data) => {
        set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
        const customer = get().customers.find(c => c.id === id);
        
      },
      
      deleteCustomer: (id) => {
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
        (async () => { await deleteParty({ data: { id } }); })().catch(console.error);
      },
      
      addSupplier: (sup) => {
        const id = uid("s");
        const obj = { ...sup, id, createdAt: new Date().toISOString() };
        set((s) => ({ suppliers: [obj, ...s.suppliers] }));
        
        return id;
      },
      
      updateSupplier: (id, data) => {
        set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...data } : x)) }));
        const supplier = get().suppliers.find((x) => x.id === id);
        
      },
      
      deleteSupplier: (id) => {
        set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }));
        
      },
      
      addInventoryItem: (i) => {
        const id = uid("i");
        const obj = { ...i, id, lastUpdated: new Date().toISOString() };
        set((s) => ({ inventory: [obj, ...s.inventory] }));
        
        return id;
      },
      
      updateInventoryItem: (id, data) => {
        set((s) => ({ inventory: s.inventory.map((x) => x.id === id ? { ...x, ...data, lastUpdated: new Date().toISOString() } : x) }));
        const item = get().inventory.find((x) => x.id === id);
        
      },
      
      deleteInventoryItem: (id) => {
        set((s) => ({ inventory: s.inventory.filter((x) => x.id !== id) }));
        (async () => { await deleteProduct({ data: { id } }); })().catch(console.error);
      },
      
      addInvoice: (i) => {
        const id = uid("inv");
        const invoice: Invoice = { ...i, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next: AppData = { ...s, invoices: [invoice, ...s.invoices] };
          next = applyInvoice(next, invoice, 1);
          return next;
        });
        (async () => { await saveInvoice({ data: invoice });  })().catch(console.error);
        return id;
      },
      
      updateInvoice: (id, data) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated: Invoice = { ...old, ...data, id };
        set((s) => {
          let next: AppData = { ...s };
          next = applyInvoice(next, old, -1);
          next = { ...next, invoices: next.invoices.map((x) => (x.id === id ? updated : x)) };
          next = applyInvoice(next, updated, 1);
          return next;
        });
        (async () => { await saveInvoice({ data: updated });  })().catch(console.error);
      },
      
      deleteInvoice: (id) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old) return;

        set((s) => {
          let next: AppData = { ...s };
          next = applyInvoice(next, old, -1);
          next = { ...next, invoices: next.invoices.filter((x) => x.id !== id) };
          return next;
        });
        (async () => { await deleteInvoiceApi({ data: { id } });  })().catch(console.error);
      },
      
      approveInvoice: (id) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated: Invoice = { ...old, isApproved: true };
        set((s) => {
          let next: AppData = { ...s, invoices: s.invoices.map((x) => (x.id === id ? updated : x)) };
          next = applyInvoice(next, updated, 1);
          return next;
        });
        (async () => { await saveInvoice({ data: updated });  })().catch(console.error);
      },
      
      addVoucher: (v) => {
        const id = uid("v");
        const voucher: Voucher = { ...v, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next: AppData = { ...s, vouchers: [voucher, ...s.vouchers] };
          next = applyVoucher(next, voucher, 1);
          return next;
        });
        (async () => { await saveVoucher({ data: voucher });  })().catch(console.error);
        return id;
      },
      
      deleteVoucher: (id) => {
        const old = get().vouchers.find((x) => x.id === id);
        if (!old) return;
        set((s) => {
          let next: AppData = { ...s };
          next = applyVoucher(next, old, -1);
          next = { ...next, vouchers: next.vouchers.filter((x) => x.id !== id) };
          return next;
        });
        (async () => { await deleteVoucherApi({ data: { id } });  })().catch(console.error);
      },
      
      addExpense: (e) => {
        const id = uid("e");
        const expense: Expense = { ...e, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next: AppData = { ...s, expenses: [expense, ...s.expenses] };
          next = applyExpense(next, expense, 1);
          return next;
        });
        (async () => { await saveExpense({ data: expense });  })().catch(console.error);
        return id;
      },
      
      deleteExpense: (id) => {
        const old = get().expenses.find((x) => x.id === id);
        if (!old) return;
        set((s) => {
          let next: AppData = { ...s };
          next = applyExpense(next, old, -1);
          next = { ...next, expenses: next.expenses.filter((x) => x.id !== id) };
          return next;
        });
        (async () => { await deleteExpenseApi({ data: { id } });  })().catch(console.error);
      }
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
      }),
    }
  )
);


if (typeof window !== "undefined") {
  let syncTimeout: any = null;
  const debouncedSync = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      if (navigator.onLine) {
         useStore.getState().syncLegacyDb().catch(console.error);
      }
    }, 2000);
  };

  useStore.persist.onFinishHydration((state) => {
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
         debouncedSync();
      }
  });

  window.addEventListener('online', debouncedSync);
  window.addEventListener('focus', () => {
    if (navigator.onLine) useStore.getState().fetchFromDb().catch(console.error);
  });
}
