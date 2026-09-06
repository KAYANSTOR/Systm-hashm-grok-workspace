import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const regexMap = {
  addSupplier: `      addSupplier: (sup) => {
        const id = uid("s");
        const obj = { ...sup, id, createdAt: new Date().toISOString() };
        set((s) => ({
          suppliers: [obj, ...s.suppliers],
        }));
        addParty({ data: obj }).catch(console.error);
        return id;
      },`,
      
  updateSupplier: `      updateSupplier: (id, data) => {
        set((s) => ({
          suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...data } : x)),
        }));
        const supplier = get().suppliers.find((x) => x.id === id);
        if (supplier) updateParty({ data: supplier }).catch(console.error);
      },`,
      
  addInventoryItem: `      addInventoryItem: (i) => {
        const id = uid("i");
        const obj = { ...i, id, lastUpdated: new Date().toISOString() };
        set((s) => ({
          inventory: [obj, ...s.inventory],
        }));
        addProduct({ data: obj }).catch(console.error);
        return id;
      },`,
      
  updateInventoryItem: `      updateInventoryItem: (id, data) => {
        set((s) => ({
          inventory: s.inventory.map((x) =>
            x.id === id ? { ...x, ...data, lastUpdated: new Date().toISOString() } : x,
          ),
        }));
        const item = get().inventory.find((x) => x.id === id);
        if (item) updateProduct({ data: item }).catch(console.error);
      },`,
      
  addInvoice: `      addInvoice: (i) => {
        const id = uid("inv");
        const invoice = { ...i, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next = { ...s, invoices: [invoice, ...s.invoices] };
          next = applyInvoice(next, invoice, 1);
          return next;
        });
        saveInvoice({ data: invoice }).then(() => get().fetchFromDb()).catch(console.error);
        return id;
      },`,
      
  updateInvoice: `      updateInvoice: (id, data) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated = { ...old, ...data, id };
        set((s) => {
          let next = { ...s };
          next = applyInvoice(next, old, -1);
          next = {
            ...next,
            invoices: next.invoices.map((x) => (x.id === id ? updated : x)),
          };
          next = applyInvoice(next, updated, 1);
          return next;
        });
        saveInvoice({ data: updated }).then(() => get().fetchFromDb()).catch(console.error);
      },`,
      
  approveInvoice: `      approveInvoice: (id) => {
        const old = get().invoices.find((x) => x.id === id);
        if (!old || old.isApproved) return;
        const updated = { ...old, isApproved: true };
        set((s) => {
          let next = {
            ...s,
            invoices: s.invoices.map((x) => (x.id === id ? updated : x)),
          };
          next = applyInvoice(next, updated, 1);
          return next;
        });
        saveInvoice({ data: updated }).then(() => get().fetchFromDb()).catch(console.error);
      },`,
      
  addVoucher: `      addVoucher: (v) => {
        const id = uid("v");
        const voucher = { ...v, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next = { ...s, vouchers: [voucher, ...s.vouchers] };
          next = applyVoucher(next, voucher, 1);
          return next;
        });
        saveVoucher({ data: voucher }).then(() => get().fetchFromDb()).catch(console.error);
        return id;
      },`,
      
  addExpense: `      addExpense: (e) => {
        const id = uid("e");
        const expense = { ...e, id, createdAt: new Date().toISOString() };
        set((s) => {
          let next = { ...s, expenses: [expense, ...s.expenses] };
          next = applyExpense(next, expense, 1);
          return next;
        });
        saveExpense({ data: expense }).then(() => get().fetchFromDb()).catch(console.error);
        return id;
      },`,
};

// Extremely naive replacement but we'll use exact strings
for (const [key, replacement] of Object.entries(regexMap)) {
  // We find the block starting with key: (params) => { ... } and replace it
  const regex = new RegExp(\`      \${key}: \\([^)]*\\) => \\{[\\s\\S]*?\\},\\n?\\s*\`);
  const regex2 = new RegExp(\`      \${key}: \\([^)]*\\) => [\\s\\S]*?\\),\\n?\\s*\`); // For shorthand arrows
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement + '\\n');
  } else if (regex2.test(code)) {
    code = code.replace(regex2, replacement + '\\n');
  }
}

fs.writeFileSync('src/lib/store.ts', code);
