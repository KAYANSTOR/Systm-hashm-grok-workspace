import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { AppData, Invoice, Voucher, Expense } from "../lib/types";

// Get all data for the client cache
export const fetchAllData = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    
    const parties = await sql`select * from parties where is_active = true`;
    const products = await sql`select * from products where is_active = true`;
    const invoices = await sql`select * from invoices order by created_at desc`;
    const invoiceItems = await sql`select * from invoice_items`;
    const vouchers = await sql`select * from vouchers order by created_at desc`;
    const expenses = await sql`select * from expenses order by created_at desc`;
    const transactions = await sql`select * from financial_transactions order by created_at desc`;
    
    // Check if DB is completely empty to allow legacy sync
    const isDbEmpty = parties.length === 0 && products.length === 0 && invoices.length === 0;

    return { parties, products, invoices, invoiceItems, vouchers, expenses, transactions, isDbEmpty } as any;
  }
);

// Sync legacy local storage data to Postgres
export const syncLegacyData = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    
    await sql.transaction(async (tx) => {
      // 1. Insert Customers
      for (const c of data.customers) {
        await tx`insert into parties (id, type, name, phone, address, created_at) 
                 values (${c.id}, 'customer', ${c.name}, ${c.phone}, ${c.address}, ${c.createdAt})
                 on conflict (id) do nothing`;
      }
      
      // 2. Insert Suppliers
      for (const s of data.suppliers) {
        await tx`insert into parties (id, type, name, phone, company, created_at)
                 values (${s.id}, 'supplier', ${s.name}, ${s.phone}, ${s.company}, ${s.createdAt})
                 on conflict (id) do nothing`;
      }
      
      // 3. Insert Inventory as Products
      for (const i of data.inventory) {
        await tx`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at)
                 values (${i.id}, ${i.name}, ${i.category}, ${i.unit}, ${i.costPrice}, ${i.sellingPrice}, ${i.minQuantity}, ${i.lastUpdated})
                 on conflict (id) do nothing`;
      }
      
      // 4. Accounts setup (Default accounts)
      await tx`insert into accounts (id, name, type) values 
                 ('cash', 'الصندوق', 'asset'),
                 ('accounts_receivable', 'ذمم مدينة (عملاء)', 'asset'),
                 ('accounts_payable', 'ذمم دائنة (موردين)', 'liability'),
                 ('sales', 'إيرادات المبيعات', 'revenue'),
                 ('purchases', 'مشتريات', 'expense'),
                 ('cogs', 'تكلفة البضاعة المباعة', 'expense')
               on conflict (id) do nothing`;
               
      // 5. Insert Invoices & Items
      for (const inv of data.invoices) {
        await tx`insert into invoices (id, invoice_number, type, invoice_type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, payment_method, status, is_approved, notes, created_at)
                 values (${inv.id}, ${inv.invoiceNumber}, ${inv.type}, ${inv.invoiceType || null}, ${inv.partyId}, ${inv.date}, ${inv.subTotal}, ${inv.discount}, ${inv.total}, ${inv.paidAmount}, ${inv.remainingAmount}, ${inv.paymentType}, ${inv.paymentMethod || null}, ${inv.status}, ${inv.isApproved}, ${inv.notes || null}, ${inv.createdAt})
                 on conflict (id) do nothing`;
                 
        for (const item of inv.items) {
          await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                   values (${item.id}, ${inv.id}, ${item.inventoryItemId || null}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})
                   on conflict (id) do nothing`;
        }
      }
      
      // 6. Insert Vouchers
      for (const v of data.vouchers) {
        await tx`insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method, description, created_at)
                 values (${v.id}, ${v.voucherNumber}, ${v.type}, ${v.partyType}, ${v.partyId || null}, ${v.amount}, ${v.date}, ${v.paymentMethod}, ${v.description}, ${v.createdAt})
                 on conflict (id) do nothing`;
      }
      
      // 7. Insert Expenses
      for (const e of data.expenses) {
        await tx`insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
                 values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})
                 on conflict (id) do nothing`;
      }
      
    });

    return { success: true };
  });

export const addParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`insert into parties (id, type, name, phone, address, company, created_at)
              values (${data.id}, ${data.type === 'retail' || data.type === 'wholesale' ? 'customer' : 'supplier'}, ${data.name}, ${data.phone || null}, ${data.address || null}, ${data.company || null}, ${data.createdAt})`;
  });

export const updateParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update parties set name=${data.name}, phone=${data.phone}, address=${data.address}, company=${data.company} where id=${data.id}`;
  });

export const deleteParty = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update parties set is_active=false where id=${data.id}`;
  });

export const addProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at)
              values (${data.id}, ${data.name}, ${data.category}, ${data.unit}, ${data.costPrice}, ${data.sellingPrice}, ${data.minQuantity}, ${data.lastUpdated})`;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update products set name=${data.name}, category=${data.category}, unit=${data.unit}, cost_price=${data.costPrice}, selling_price=${data.sellingPrice}, min_stock=${data.minQuantity} where id=${data.id}`;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update products set is_active=false where id=${data.id}`;
  });

export const saveInvoice = createServerFn({ method: "POST" })
  .validator((data: Invoice) => data)
  .handler(async ({ data: inv }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      // 1. Save invoice
      await tx`insert into invoices (id, invoice_number, type, invoice_type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, payment_method, status, is_approved, notes, created_at)
               values (${inv.id}, ${inv.invoiceNumber}, ${inv.type}, ${inv.invoiceType || null}, ${inv.partyId}, ${inv.date}, ${inv.subTotal}, ${inv.discount}, ${inv.total}, ${inv.paidAmount}, ${inv.remainingAmount}, ${inv.paymentType}, ${inv.paymentMethod || null}, ${inv.status}, ${inv.isApproved}, ${inv.notes || null}, ${inv.createdAt})
               on conflict (id) do update set 
               sub_total=${inv.subTotal}, discount=${inv.discount}, total=${inv.total}, paid_amount=${inv.paidAmount}, remaining_amount=${inv.remainingAmount}, status=${inv.status}`;
      
      // 2. Save items (delete old ones if update, then insert)
      await tx`delete from invoice_items where invoice_id=${inv.id}`;
      for (const item of inv.items) {
        await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                 values (${item.id}, ${inv.id}, ${item.inventoryItemId || null}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})`;
      }

      // If approved, do accounting & inventory movements
      if (inv.isApproved) {
         // Inventory movements
         for (const item of inv.items) {
            if (item.inventoryItemId && item.inventoryItemId !== "SERVICE") {
               const qty = inv.type === "sale" ? -item.quantity : item.quantity;
               await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
                        values (${item.id + '_mov'}, ${item.inventoryItemId}, 'wh1', ${inv.type}, ${qty}, 'invoice', ${inv.id})`;
            }
         }
         
         // Financial Transactions
         const dir = inv.type === "sale" ? 1 : -1;
         const partyDebit = inv.type === "sale" ? inv.total : 0;
         const partyCredit = inv.type === "purchase" ? inv.total : 0;
         
         await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                  values (${inv.id + '_party'}, ${inv.type === 'sale' ? 'accounts_receivable' : 'accounts_payable'}, ${inv.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'invoice', ${inv.id}, ${inv.type === 'sale' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}, ${inv.createdAt})`;
         
         if (inv.paidAmount > 0) {
            const payDebit = inv.type === "sale" ? inv.paidAmount : 0;
            const payCredit = inv.type === "purchase" ? inv.paidAmount : 0;
            await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                     values (${inv.id + '_pay'}, 'cash', ${inv.partyId}, ${payDebit - payCredit}, ${payDebit}, ${payCredit}, 'invoice_payment', ${inv.id}, ${'سداد فاتورة'}, ${inv.createdAt})`;
         }
      }
    });
  });

export const deleteInvoiceApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
       await tx`delete from financial_transactions where reference_id=${data.id}`;
       await tx`delete from inventory_movements where reference_id=${data.id}`;
       await tx`delete from invoice_items where invoice_id=${data.id}`;
       await tx`delete from invoices where id=${data.id}`;
    });
  });

export const saveVoucher = createServerFn({ method: "POST" })
  .validator((data: Voucher) => data)
  .handler(async ({ data: v }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method, description, created_at)
               values (${v.id}, ${v.voucherNumber}, ${v.type}, ${v.partyType}, ${v.partyId || null}, ${v.amount}, ${v.date}, ${v.paymentMethod}, ${v.description}, ${v.createdAt})`;
      
      const isReceipt = v.type === "receipt";
      const cashDebit = isReceipt ? v.amount : 0;
      const cashCredit = !isReceipt ? v.amount : 0;
      
      await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${v.id + '_cash'}, 'cash', ${v.partyId || null}, ${cashDebit - cashCredit}, ${cashDebit}, ${cashCredit}, 'voucher', ${v.id}, ${v.description}, ${v.createdAt})`;
    });
  });

export const deleteVoucherApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
       await tx`delete from financial_transactions where reference_id=${data.id}`;
       await tx`delete from vouchers where id=${data.id}`;
    });
  });

export const saveExpense = createServerFn({ method: "POST" })
  .validator((data: Expense) => data)
  .handler(async ({ data: e }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
               values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})`;
      
      await tx`insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${e.id + '_cash'}, 'cash', ${-e.amount}, 0, ${e.amount}, 'expense', ${e.id}, ${e.description}, ${e.createdAt})`;
    });
  });

export const deleteExpenseApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
       await tx`delete from financial_transactions where reference_id=${data.id}`;
       await tx`delete from expenses where id=${data.id}`;
    });
  });
