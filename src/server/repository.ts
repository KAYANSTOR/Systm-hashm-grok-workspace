import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { AppData, Invoice, Voucher, Expense } from "../lib/types";

// Get all data for the client cache
export const fetchAllData = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    
    const orgs = await sql`select * from organization_profile limit 1`;
    const parties = await sql`select * from parties where is_active = true`;
    const products = await sql`select * from products where is_active = true`;
    const stock = await sql`select product_id, quantity from warehouse_stock where warehouse_id = 'wh1'`;
    const invoices = await sql`select * from invoices order by created_at desc`;
    const invoiceItems = await sql`select * from invoice_items`;
    const vouchers = await sql`select * from vouchers order by created_at desc`;
    const expenses = await sql`select * from expenses order by created_at desc`;
    const transactions = await sql`select * from financial_transactions order by created_at desc`;
    
    // Check if DB is completely empty to allow legacy sync
    const isDbEmpty = parties.length === 0 && products.length === 0 && invoices.length === 0;

    const organization = orgs.length > 0 ? { id: orgs[0].id, name: orgs[0].name, description: orgs[0].description, logo: orgs[0].logo, phone: orgs[0].phone, address: orgs[0].address, email: orgs[0].email, website: orgs[0].website, taxNumber: orgs[0].tax_number, commercialNumber: orgs[0].commercial_number, footerText: orgs[0].footer_text } : null;
    return { organization, parties, products, stock, invoices, invoiceItems, vouchers, expenses, transactions, isDbEmpty } as any;
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
                 on conflict (id) do update set name=EXCLUDED.name, phone=EXCLUDED.phone, address=EXCLUDED.address`;
      }
      
      // 2. Insert Suppliers
      for (const s of data.suppliers) {
        await tx`insert into parties (id, type, name, phone, company, created_at)
                 values (${s.id}, 'supplier', ${s.name}, ${s.phone}, ${s.company}, ${s.createdAt})
                 on conflict (id) do update set name=EXCLUDED.name, phone=EXCLUDED.phone, company=EXCLUDED.company`;
      }
      
      // 3. Insert Inventory as Products
      for (const i of data.inventory) {
        await tx`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at)
                 values (${i.id}, ${i.name}, ${i.category}, ${i.unit}, ${i.costPrice}, ${i.sellingPrice}, ${i.minQuantity}, ${i.lastUpdated})
                 on conflict (id) do update set name=EXCLUDED.name, category=EXCLUDED.category, unit=EXCLUDED.unit, cost_price=EXCLUDED.cost_price, selling_price=EXCLUDED.selling_price, min_stock=EXCLUDED.min_stock`;
        await tx`insert into warehouse_stock (warehouse_id, product_id, quantity)
                 values ('wh1', ${i.id}, ${i.quantity})
                 on conflict (warehouse_id, product_id) do update set quantity=EXCLUDED.quantity`;
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
      await tx`insert into parties (id, type, name, phone, address, created_at)
               values ('PENDING_RECEIPT', 'supplier', 'مورد توريد مخزني - بانتظار تحديد المورد', '-', '-', now())
               on conflict (id) do nothing`;
      for (const inv of data.invoices) {
        await tx`insert into invoices (id, invoice_number, type, invoice_type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, payment_method, status, is_approved, notes, created_at)
                 values (${inv.id}, ${inv.invoiceNumber}, ${inv.type}, ${inv.invoiceType || null}, ${inv.partyId}, ${inv.date}, ${inv.subTotal}, ${inv.discount}, ${inv.total}, ${inv.paidAmount}, ${inv.remainingAmount}, ${inv.paymentType}, ${inv.paymentMethod || null}, ${inv.status}, ${inv.isApproved}, ${inv.notes || null}, ${inv.createdAt})
                 on conflict (id) do update set invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, invoice_type=EXCLUDED.invoice_type, party_id=EXCLUDED.party_id, date=EXCLUDED.date, sub_total=EXCLUDED.sub_total, discount=EXCLUDED.discount, total=EXCLUDED.total, paid_amount=EXCLUDED.paid_amount, remaining_amount=EXCLUDED.remaining_amount, payment_type=EXCLUDED.payment_type, payment_method=EXCLUDED.payment_method, status=EXCLUDED.status, is_approved=EXCLUDED.is_approved, notes=EXCLUDED.notes`;
                 
        await tx`delete from invoice_items where invoice_id=${inv.id}`;
        for (const item of inv.items) {
          await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                   values (${item.id}, ${inv.id}, ${item.inventoryItemId === 'SERVICE' ? null : (item.inventoryItemId || null)}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})
                   on conflict (id) do update set quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, total=EXCLUDED.total`;
        }
        await tx`delete from financial_transactions where reference_id=${inv.id}`;
        await tx`delete from inventory_movements where reference_id=${inv.id}`;
        if (inv.isApproved) {
          for (const item of inv.items) {
            if (item.inventoryItemId && item.inventoryItemId !== 'SERVICE') {
              const qty = inv.type === 'sale' ? -item.quantity : item.quantity;
              await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
                       values (${item.id + '_mov'}, ${item.inventoryItemId}, 'wh1', ${inv.type}, ${qty}, 'invoice', ${inv.id})`;
            }
          }
          const partyDebit = inv.type === 'sale' ? inv.total : 0;
          const partyCredit = inv.type === 'purchase' ? inv.total : 0;
          await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                   values (${inv.id + '_party'}, ${inv.type === 'sale' ? 'accounts_receivable' : 'accounts_payable'}, ${inv.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'invoice', ${inv.id}, ${inv.type === 'sale' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}, ${inv.createdAt})`;
          if (inv.paidAmount > 0) {
            const payDebit = inv.type === 'sale' ? inv.paidAmount : 0;
            const payCredit = inv.type === 'purchase' ? inv.paidAmount : 0;
            await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                     values (${inv.id + '_pay'}, 'cash', ${inv.partyId}, ${payDebit - payCredit}, ${payDebit}, ${payCredit}, 'invoice_payment', ${inv.id}, 'سداد فاتورة', ${inv.createdAt})`;
          }
        }
      }
      
      
      // 5.5 Insert Transactions
      for (const t of data.transactions) {
        await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                 values (${t.id}, ${t.cashIn > 0 || t.cashOut > 0 ? 'cash' : (t.partyType === 'customer' ? 'accounts_receivable' : 'accounts_payable')}, ${t.partyId || null}, ${t.debit - t.credit}, ${t.debit}, ${t.credit}, ${t.documentType}, ${t.documentId}, ${t.description}, ${t.date})
                 on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
      }
      
      // 6. Insert Vouchers
      for (const v of data.vouchers) {
        await tx`insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method, description, created_at)
                 values (${v.id}, ${v.voucherNumber}, ${v.type}, ${v.partyType}, ${v.partyId || null}, ${v.amount}, ${v.date}, ${v.paymentMethod}, ${v.description}, ${v.createdAt})
                 on conflict (id) do update set amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, description=EXCLUDED.description`;
      }
      
      // 7. Insert Expenses
      for (const e of data.expenses) {
        await tx`insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
                 values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})
                 on conflict (id) do update set amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, description=EXCLUDED.description`;
      }
    });
  });

export const addParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    const sql = await getSql();
    await sql`insert into parties (id, type, name, phone, address, company, created_at) values (${p.id}, ${p.type}, ${p.name}, ${p.phone || null}, ${p.address || null}, ${p.company || null}, ${p.createdAt})`;
  });

export const updateParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    const sql = await getSql();
    await sql`update parties set name=${p.name}, phone=${p.phone || null}, address=${p.address || null}, company=${p.company || null} where id=${p.id}`;
  });

export const deleteParty = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update parties set is_active=false, archived_at=now() where id=${data.id}`;
  });

export const addProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    const sql = await getSql();
    await sql`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at) values (${p.id}, ${p.name}, ${p.category}, ${p.unit || null}, ${p.costPrice}, ${p.sellingPrice}, ${p.minQuantity}, ${p.lastUpdated})`;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    const sql = await getSql();
    await sql`update products set name=${p.name}, category=${p.category}, unit=${p.unit || null}, cost_price=${p.costPrice}, selling_price=${p.sellingPrice}, min_stock=${p.minQuantity} where id=${p.id}`;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update products set is_active=false, archived_at=now() where id=${data.id}`;
  });

export const saveInvoice = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: inv }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      // Warehouse receipts are submitted before the manager knows the supplier.
      // The invoices.party_id foreign key still requires a real party row, so
      // materialize the stable placeholder before inserting the invoice.
      if (inv.partyId === "PENDING_RECEIPT") {
        await tx`insert into parties (id, type, name, phone, address, created_at)
                 values ('PENDING_RECEIPT', 'supplier', 'مورد توريد مخزني - بانتظار تحديد المورد', '-', '-', now())
                 on conflict (id) do nothing`;
      }
      await tx`insert into invoices (id, invoice_number, type, invoice_type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, payment_method, status, is_approved, notes, created_at)
               values (${inv.id}, ${inv.invoiceNumber}, ${inv.type}, ${inv.invoiceType || null}, ${inv.partyId}, ${inv.date}, ${inv.subTotal}, ${inv.discount}, ${inv.total}, ${inv.paidAmount}, ${inv.remainingAmount}, ${inv.paymentType}, ${inv.paymentMethod || null}, ${inv.status}, ${inv.isApproved}, ${inv.notes || null}, ${inv.createdAt})
               on conflict (id) do update set 
               invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, invoice_type=EXCLUDED.invoice_type, party_id=EXCLUDED.party_id, date=EXCLUDED.date, sub_total=EXCLUDED.sub_total, discount=EXCLUDED.discount, total=EXCLUDED.total, paid_amount=EXCLUDED.paid_amount, remaining_amount=EXCLUDED.remaining_amount, payment_type=EXCLUDED.payment_type, payment_method=EXCLUDED.payment_method, status=EXCLUDED.status, is_approved=EXCLUDED.is_approved, notes=EXCLUDED.notes`;
      
      await tx`delete from invoice_items where invoice_id=${inv.id}`;
      await tx`delete from financial_transactions where reference_id=${inv.id}`;
      const previousMovements = await tx`select product_id, quantity from inventory_movements where reference_id=${inv.id}`;
      for (const movement of previousMovements as any[]) {
        await tx`update warehouse_stock set quantity=quantity - ${movement.quantity} where warehouse_id='wh1' and product_id=${movement.product_id}`;
      }
      await tx`delete from inventory_movements where reference_id=${inv.id}`;
      for (const item of inv.items) {
          await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                 values (${item.id}, ${inv.id}, ${item.inventoryItemId === 'SERVICE' ? null : (item.inventoryItemId || null)}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})`;
      }

      if (inv.isApproved) {
         for (const item of inv.items) {
            if (item.inventoryItemId && item.inventoryItemId !== "SERVICE") {
               const qty = inv.type === "sale" ? -item.quantity : item.quantity;
               await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
               values (${item.id + '_mov'}, ${item.inventoryItemId}, 'wh1', ${inv.type}, ${qty}, 'invoice', ${inv.id})
               on conflict (id) do update set quantity=EXCLUDED.quantity, movement_type=EXCLUDED.movement_type`;
               await tx`insert into warehouse_stock (warehouse_id, product_id, quantity)
               values ('wh1', ${item.inventoryItemId}, ${qty})
               on conflict (warehouse_id, product_id) do update set quantity=warehouse_stock.quantity + ${qty}`;
            }
         }
         
         const partyDebit = inv.type === "sale" ? inv.total : 0;
         const partyCredit = inv.type === "purchase" ? inv.total : 0;
         
         await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                  values (${inv.id + '_party'}, ${inv.type === 'sale' ? 'accounts_receivable' : 'accounts_payable'}, ${inv.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'invoice', ${inv.id}, ${inv.type === 'sale' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}, ${inv.createdAt})
                  on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit, party_id=EXCLUDED.party_id`;
         
         if (inv.paidAmount > 0) {
            const payDebit = inv.type === "sale" ? inv.paidAmount : 0;
            const payCredit = inv.type === "purchase" ? inv.paidAmount : 0;
            await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                     values (${inv.id + '_pay'}, 'cash', ${inv.partyId}, ${payDebit - payCredit}, ${payDebit}, ${payCredit}, 'invoice_payment', ${inv.id}, ${'سداد فاتورة'}, ${inv.createdAt})
                     on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
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
       const oldMovements = await tx`select product_id, quantity from inventory_movements where reference_id=${data.id}`;
       for (const movement of oldMovements as any[]) {
         await tx`update warehouse_stock set quantity=quantity - ${movement.quantity} where warehouse_id='wh1' and product_id=${movement.product_id}`;
       }
       await tx`delete from inventory_movements where reference_id=${data.id}`;
       await tx`delete from invoice_items where invoice_id=${data.id}`;
       await tx`delete from invoices where id=${data.id}`;
    });
  });

export const saveVoucher = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: v }) => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method, description, created_at)
               values (${v.id}, ${v.voucherNumber}, ${v.type}, ${v.partyType}, ${v.partyId || null}, ${v.amount}, ${v.date}, ${v.paymentMethod}, ${v.description}, ${v.createdAt})
               on conflict (id) do update set amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, description=EXCLUDED.description`;
      await tx`delete from financial_transactions where reference_id=${v.id}`;
      
      const isReceipt = v.type === "receipt";
      const cashDebit = isReceipt ? v.amount : 0;
      const cashCredit = !isReceipt ? v.amount : 0;
      
      await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${v.id + '_cash'}, 'cash', ${v.partyId || null}, ${cashDebit - cashCredit}, ${cashDebit}, ${cashCredit}, 'voucher', ${v.id}, ${v.description}, ${v.createdAt})`;

      if (v.partyId) {
         const partyDebit = isReceipt ? 0 : v.amount;
         const partyCredit = isReceipt ? v.amount : 0;
         await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                  values (${v.id + '_party'}, ${v.partyType === 'customer' ? 'accounts_receivable' : 'accounts_payable'}, ${v.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'voucher', ${v.id}, ${v.description}, ${v.createdAt})`;
      }
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
               values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set category=EXCLUDED.category, amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, type=EXCLUDED.type, description=EXCLUDED.description`;
      await tx`delete from financial_transactions where reference_id=${e.id}`;
      
      await tx`insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${e.id + '_cash'}, 'cash', ${-e.amount}, 0, ${e.amount}, 'expense', ${e.id}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
      await tx`insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${e.id + '_expense'}, 'purchases', ${e.amount}, ${e.amount}, 0, 'expense', ${e.id}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
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


export const saveOrganization = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`insert into organization_profile (id, name, description, logo, phone, address, email, website, tax_number, commercial_number, footer_text)
              values ('default_org', ${data.name}, ${data.description || null}, ${data.logo || null}, ${data.phone || null}, ${data.address || null}, ${data.email || null}, ${data.website || null}, ${data.taxNumber || null}, ${data.commercialNumber || null}, ${data.footerText || null})
              on conflict (id) do update set 
                name=EXCLUDED.name, description=EXCLUDED.description, logo=EXCLUDED.logo, 
                phone=EXCLUDED.phone, address=EXCLUDED.address, email=EXCLUDED.email, 
                website=EXCLUDED.website, tax_number=EXCLUDED.tax_number, 
                commercial_number=EXCLUDED.commercial_number, footer_text=EXCLUDED.footer_text, 
                updated_at=now()`;
  });

export const resetDatabase = createServerFn({ method: "POST" }).handler(async () => {
    const sql = await getSql();
    await sql.transaction(async (tx) => {
        await tx`delete from financial_transactions`;
        await tx`delete from inventory_movements`;
        await tx`delete from invoice_items`;
        await tx`delete from invoices`;
        await tx`delete from vouchers`;
        await tx`delete from expenses`;
        await tx`delete from products`;
        await tx`delete from parties`;
        // organization_profile is kept or reset? we can keep it
    });
});
