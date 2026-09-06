import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

// Insert imports
const imports = `import { fetchAllData, syncLegacyData, addParty, updateParty, deleteParty, addProduct, updateProduct, deleteProduct, saveInvoice, deleteInvoiceApi, saveVoucher, deleteVoucherApi, saveExpense, deleteExpenseApi } from "../server/repository";
`;
code = code.replace('import { uid } from "./utils";', 'import { uid } from "./utils";\n' + imports);

// Add fetchFromDb and syncLegacy to Store type
code = code.replace('type Store = AppData & {', 'type Store = AppData & {\n  fetchFromDb: () => Promise<void>;\n  syncLegacyDb: () => Promise<void>;');

// Add implementation
const fetchImpl = `
      fetchFromDb: async () => {
        const data = await fetchAllData();
        set({
           customers: (data.parties || []).filter((p: any) => p.type === 'customer' || p.type === 'retail' || p.type === 'wholesale'),
           suppliers: (data.parties || []).filter((p: any) => p.type === 'supplier'),
           inventory: (data.products || []).map((p: any) => ({ ...p, costPrice: Number(p.cost_price), sellingPrice: Number(p.selling_price), minQuantity: Number(p.min_stock) })),
           invoices: data.invoices || [],
           vouchers: data.vouchers || [],
           expenses: data.expenses || [],
           transactions: data.transactions || []
        });
      },
      syncLegacyDb: async () => {
        const s = get();
        await syncLegacyData({
          customers: s.customers,
          suppliers: s.suppliers,
          inventory: s.inventory,
          invoices: s.invoices,
          vouchers: s.vouchers,
          transactions: s.transactions,
          expenses: s.expenses,
          settings: s.settings
        });
        await get().fetchFromDb();
      },
`;

code = code.replace('resetDemo: () => set({ ...makeSeed() }),', 'resetDemo: () => set({ ...makeSeed() }),' + fetchImpl);

// Patch addCustomer
code = code.replace(
  '      addCustomer: (c) => {\n        const id = uid("c");\n        set((s) => ({\n          customers: [{ ...c, id, createdAt: new Date().toISOString() }, ...s.customers],\n        }));\n        return id;\n      },',
  `      addCustomer: (c) => {
        const id = uid("c");
        const obj = { ...c, id, createdAt: new Date().toISOString() };
        set((s) => ({ customers: [obj, ...s.customers] }));
        addParty({ data: obj }).catch(console.error);
        return id;
      },`
);

// Patch updateCustomer
code = code.replace(
  '      updateCustomer: (id, data) =>\n        set((s) => ({\n          customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),\n        })),',
  `      updateCustomer: (id, data) => {
        set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
        const customer = get().customers.find(c => c.id === id);
        if(customer) updateParty({ data: customer }).catch(console.error);
      },`
);

fs.writeFileSync('src/lib/store.ts', code);
