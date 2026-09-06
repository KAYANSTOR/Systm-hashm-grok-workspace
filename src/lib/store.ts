import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyExpense, applyInvoice, applyVoucher } from "./accounting";
import { makeSeed } from "./seed";
import type {
  AppData,
  Customer,
  Expense,
  InventoryItem,
  Invoice,
  Supplier,
  Voucher,
  WorkshopSettings,
} from "./types";
import { uid } from "./utils";

type Store = AppData & {
  resetDemo: () => void;
  importData: (data: AppData) => void;
  updateSettings: (patch: Partial<WorkshopSettings>) => void;

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

const seed = makeSeed();

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...seed,
      resetDemo: () => set({ ...makeSeed() }),

      importData: (data) =>
        set({
          customers: data.customers ?? [],
          suppliers: data.suppliers ?? [],
          inventory: data.inventory ?? [],
          invoices: data.invoices ?? [],
          vouchers: data.vouchers ?? [],
          transactions: data.transactions ?? [],
          expenses: data.expenses ?? [],
          settings: { ...seed.settings, ...data.settings },
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      addCustomer: (c) => {
        const id = uid("c");
        set((s) => ({
          customers: [{ ...c, id, createdAt: new Date().toISOString() }, ...s.customers],
        }));
        return id;
      },
      updateCustomer: (id, data) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      addSupplier: (sup) => {
        const id = uid("s");
        set((s) => ({
          suppliers: [{ ...sup, id, createdAt: new Date().toISOString() }, ...s.suppliers],
        }));
        return id;
      },
      updateSupplier: (id, data) =>
        set((s) => ({
          suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...data } : x)),
        })),
      deleteSupplier: (id) =>
        set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),

      addInventoryItem: (i) => {
        const id = uid("i");
        set((s) => ({
          inventory: [
            { ...i, id, lastUpdated: new Date().toISOString() },
            ...s.inventory,
          ],
        }));
        return id;
      },
      updateInventoryItem: (id, data) =>
        set((s) => ({
          inventory: s.inventory.map((x) =>
            x.id === id ? { ...x, ...data, lastUpdated: new Date().toISOString() } : x,
          ),
        })),
      deleteInventoryItem: (id) =>
        set((s) => ({ inventory: s.inventory.filter((x) => x.id !== id) })),

      addInvoice: (i) => {
        const id = uid("inv");
        const invoice: Invoice = { ...i, id, createdAt: new Date().toISOString() };
        set((s) => {
          const exists = s.invoices.some((inv) => inv.invoiceNumber === invoice.invoiceNumber);
          if (exists) {
            return s;
          }
          let next: AppData = { ...s, invoices: [invoice, ...s.invoices] };
          next = applyInvoice(next, invoice, 1);
          return next;
        });
        return id;
      },
      updateInvoice: (id, data) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated: Invoice = { ...old, ...data, id };
        set((s) => {
          const exists = s.invoices.some((inv) => inv.invoiceNumber === updated.invoiceNumber && inv.id !== id);
          if (exists) {
            return s;
          }
          let next: AppData = { ...s };
          next = applyInvoice(next, old, -1);
          next = {
            ...next,
            invoices: next.invoices.map((x) => (x.id === id ? updated : x)),
          };
          next = applyInvoice(next, updated, 1);
          return next;
        });
      },
      deleteInvoice: (id) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        set((s) => {
          let next: AppData = { ...s };
          next = applyInvoice(next, old, -1);
          next = { ...next, invoices: next.invoices.filter((x) => x.id !== id) };
          return next;
        });
      },
      approveInvoice: (id) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated: Invoice = { ...old, isApproved: true };
        set((s) => {
          const exists = s.invoices.some((inv) => inv.invoiceNumber === updated.invoiceNumber && inv.id !== id);
          if (exists) {
            return s;
          }
          let next: AppData = {
            ...s,
            invoices: s.invoices.map((x) => (x.id === id ? updated : x)),
          };
          next = applyInvoice(next, updated, 1);
          return next;
        });
      },

      addVoucher: (v) => {
        const id = uid("v");
        const voucher: Voucher = { ...v, id, createdAt: new Date().toISOString() };
        set((s) => {
          const exists = s.vouchers.some((vch) => vch.voucherNumber === voucher.voucherNumber);
          if (exists) {
            return s;
          }
          let next: AppData = { ...s, vouchers: [voucher, ...s.vouchers] };
          next = applyVoucher(next, voucher, 1);
          return next;
        });
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
      },

      addExpense: (e) => {
        const id = uid("e");
        const expense: Expense = { ...e, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next: AppData = { ...s, expenses: [expense, ...s.expenses] };
          next = applyExpense(next, expense, 1);
          return next;
        });
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
      },
    }),
    {
      name: "hashem-workshop-v1",
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
    },
  ),
);

if (typeof window !== "undefined") {
  void useStore.persist.rehydrate();
}
