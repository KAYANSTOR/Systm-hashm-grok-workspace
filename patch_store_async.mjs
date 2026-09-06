import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const toReplace = [
  'Promise.resolve(deleteInvoiceApi({ data: { id } })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(deleteVoucherApi({ data: { id } })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(deleteExpenseApi({ data: { id } })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(saveInvoice({ data: invoice })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(saveInvoice({ data: updated })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(saveVoucher({ data: voucher })).then(() => get().fetchFromDb()).catch(console.error);',
  'Promise.resolve(saveExpense({ data: expense })).then(() => get().fetchFromDb()).catch(console.error);'
];

const replacement = [
  '(async () => { await deleteInvoiceApi({ data: { id } }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await deleteVoucherApi({ data: { id } }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await deleteExpenseApi({ data: { id } }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await saveInvoice({ data: invoice }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await saveInvoice({ data: updated }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await saveVoucher({ data: voucher }); await get().fetchFromDb(); })().catch(console.error);',
  '(async () => { await saveExpense({ data: expense }); await get().fetchFromDb(); })().catch(console.error);'
];

for(let i=0; i<toReplace.length; i++) {
  // global replace
  code = code.split(toReplace[i]).join(replacement[i]);
}

fs.writeFileSync('src/lib/store.ts', code);
