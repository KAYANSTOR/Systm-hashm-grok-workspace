import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
  'transactions: data.transactions || []',
  `transactions: (data.transactions || []).map((t: any) => ({
             id: t.id,
             date: t.created_at,
             documentId: t.reference_id,
             documentNumber: t.reference_id,
             documentType: t.reference_type === 'invoice' ? 'invoice' : t.reference_type === 'voucher' ? 'voucher' : 'expense',
             partyId: t.party_id,
             debit: Number(t.debit),
             credit: Number(t.credit),
             cashIn: t.account_id === 'cash' ? Number(t.debit) : 0,
             cashOut: t.account_id === 'cash' ? Number(t.credit) : 0,
             description: t.description
           }))`
);

fs.writeFileSync('src/lib/store.ts', code);
