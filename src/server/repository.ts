import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { AppData, Invoice, Voucher, Expense } from "../lib/types";
import { DEFAULT_WAREHOUSE_ID } from "../domain/inventory.ts";
import { requirePermission, listUserPermissions, PERMS } from "./permissions.ts";
import { requireUserId } from "../lib/auth/verify.server";

function resolveWarehouseId(explicit?: string | null): string {
  const id = (explicit || "").trim();
  return id || DEFAULT_WAREHOUSE_ID;
}

// Get all data for the client cache
export const fetchAllData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const userPermissions = await listUserPermissions(userId);
  const sql = await getSql();

  const orgs = await sql`select * from organization_profile limit 1`;
  const parties = await sql`select * from parties where is_active = true`;
  const products = await sql`select * from products where is_active = true`;
  const stock = await sql`select warehouse_id, product_id, quantity from warehouse_stock`;
  const warehouses = await sql`select * from warehouses order by created_at`;
  let auditEvents: any[] = [];
  try {
    auditEvents = await sql`select * from audit_events order by created_at desc limit 200`;
  } catch {
    auditEvents = [];
  }
  const invoices = await sql`select * from invoices order by created_at desc`;
  const invoiceItems = await sql`select * from invoice_items`;
  const vouchers = await sql`select * from vouchers order by created_at desc`;
  const expenses = await sql`select * from expenses order by created_at desc`;
  const transactions = await sql`select * from financial_transactions order by created_at desc`;

  // Check if DB is completely empty to allow legacy sync
  const isDbEmpty = parties.length === 0 && products.length === 0 && invoices.length === 0;

  const organization =
    orgs.length > 0
      ? {
          id: orgs[0].id,
          name: orgs[0].name,
          description: orgs[0].description,
          logo: orgs[0].logo,
          phone: orgs[0].phone,
          address: orgs[0].address,
          email: orgs[0].email,
          website: orgs[0].website,
          taxNumber: orgs[0].tax_number,
          commercialNumber: orgs[0].commercial_number,
          footerText: orgs[0].footer_text,
        }
      : null;
  return {
    organization,
    parties,
    products,
    stock,
    warehouses,
    invoices,
    invoiceItems,
    vouchers,
    expenses,
    transactions,
    auditEvents,
    isDbEmpty,
    userPermissions,
    userId,
  } as any;
});

// Sync legacy local storage data to Postgres
export const syncLegacyData = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.SYNC_WRITE);
    const sql = await getSql();
    const customers = Array.isArray(data.customers) ? data.customers : [];
    const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
    const inventory = Array.isArray(data.inventory) ? data.inventory : [];
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const vouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const warehouses = Array.isArray(data.warehouses) ? data.warehouses : [];
    const productCategories = Array.isArray(data.productCategories) ? data.productCategories : [];

    await sql.transaction(async (tx) => {
      // Snapshot sync merges the durable local snapshot. It must not replay
      // the live stock gate because warehouse_stock already contains the
      // final local balance and invoices/movements are historical records.
      for (const warehouse of warehouses) {
        await tx`insert into warehouses (id, name, location, is_active, created_at)
                 values (${warehouse.id}, ${warehouse.name}, ${warehouse.location || null}, ${warehouse.isActive !== false}, ${warehouse.createdAt || new Date().toISOString()})
                 on conflict (id) do update set name=EXCLUDED.name, location=EXCLUDED.location, is_active=EXCLUDED.is_active`;
      }
      for (const category of productCategories) {
        await tx`insert into product_categories (id, name, is_active)
                 values (${category.id}, ${category.name}, ${category.isActive !== false})
                 on conflict (id) do update set name=EXCLUDED.name, is_active=EXCLUDED.is_active`;
      }
      if (data.organization) {
        const org = data.organization;
        await tx`insert into organization_profile (id, name, description, logo, phone, address, email, website, tax_number, commercial_number, footer_text)
                 values ('default_org', ${org.name || "معمل هاشم"}, ${org.description || null}, ${org.logo || null}, ${org.phone || null}, ${org.address || null}, ${org.email || null}, ${org.website || null}, ${org.taxNumber || null}, ${org.commercialNumber || null}, ${org.footerText || null})
                 on conflict (id) do update set name=EXCLUDED.name, description=EXCLUDED.description, logo=EXCLUDED.logo, phone=EXCLUDED.phone, address=EXCLUDED.address, email=EXCLUDED.email, website=EXCLUDED.website, tax_number=EXCLUDED.tax_number, commercial_number=EXCLUDED.commercial_number, footer_text=EXCLUDED.footer_text, updated_at=now()`;
      }

      // 1. Insert Customers
      for (const c of customers) {
        await tx`insert into parties (id, type, name, phone, address, created_at) 
                 values (${c.id}, 'customer', ${c.name}, ${c.phone}, ${c.address}, ${c.createdAt})
                 on conflict (id) do update set name=EXCLUDED.name, phone=EXCLUDED.phone, address=EXCLUDED.address`;
      }

      // 2. Insert Suppliers
      for (const s of suppliers) {
        await tx`insert into parties (id, type, name, phone, company, created_at)
                 values (${s.id}, 'supplier', ${s.name}, ${s.phone}, ${s.company}, ${s.createdAt})
                 on conflict (id) do update set name=EXCLUDED.name, phone=EXCLUDED.phone, company=EXCLUDED.company`;
      }

      // 3. Insert Inventory as Products
      for (const i of inventory) {
        await tx`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at)
                 values (${i.id}, ${i.name}, ${i.category}, ${i.unit}, ${i.costPrice}, ${i.sellingPrice}, ${i.minQuantity}, ${i.lastUpdated})
                 on conflict (id) do update set name=EXCLUDED.name, category=EXCLUDED.category, unit=EXCLUDED.unit, cost_price=EXCLUDED.cost_price, selling_price=EXCLUDED.selling_price, min_stock=EXCLUDED.min_stock`;
        await tx`insert into warehouse_stock (warehouse_id, product_id, quantity)
                 values (${resolveWarehouseId(i.warehouseId)}, ${i.id}, ${i.quantity})
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
      for (const inv of invoices) {
        await tx`insert into invoices (id, invoice_number, type, invoice_type, party_id, date, sub_total, discount, total, paid_amount, remaining_amount, payment_type, payment_method, status, is_approved, notes, created_at)
                 values (${inv.id}, ${inv.invoiceNumber}, ${inv.type}, ${inv.invoiceType || null}, ${inv.partyId}, ${inv.date}, ${inv.subTotal}, ${inv.discount}, ${inv.total}, ${inv.paidAmount}, ${inv.remainingAmount}, ${inv.paymentType}, ${inv.paymentMethod || null}, ${inv.status}, ${inv.isApproved}, ${inv.notes || null}, ${inv.createdAt})
                 on conflict (id) do update set invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, invoice_type=EXCLUDED.invoice_type, party_id=EXCLUDED.party_id, date=EXCLUDED.date, sub_total=EXCLUDED.sub_total, discount=EXCLUDED.discount, total=EXCLUDED.total, paid_amount=EXCLUDED.paid_amount, remaining_amount=EXCLUDED.remaining_amount, payment_type=EXCLUDED.payment_type, payment_method=EXCLUDED.payment_method, status=EXCLUDED.status, is_approved=EXCLUDED.is_approved, notes=EXCLUDED.notes`;

        await tx`delete from invoice_items where invoice_id=${inv.id}`;
        for (const item of inv.items) {
          await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                   values (${item.id}, ${inv.id}, ${item.inventoryItemId === "SERVICE" ? null : item.inventoryItemId || null}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})
                   on conflict (id) do update set quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, total=EXCLUDED.total`;
        }
        await tx`delete from financial_transactions where reference_id=${inv.id}`;
        await tx`delete from inventory_movements where reference_id=${inv.id}`;
        if (inv.isApproved) {
          for (const item of inv.items) {
            if (item.inventoryItemId && item.inventoryItemId !== "SERVICE") {
              const whId = resolveWarehouseId(inv.warehouseId);
              const qty = inv.type === "sale" ? -item.quantity : item.quantity;
              await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
                       values (${item.id + "_mov"}, ${item.inventoryItemId}, ${whId}, ${inv.type}, ${qty}, 'invoice', ${inv.id})
                       on conflict (id) do update set quantity=EXCLUDED.quantity, warehouse_id=EXCLUDED.warehouse_id, movement_type=EXCLUDED.movement_type`;
            }
          }
          const partyDebit = inv.type === "sale" ? inv.total : 0;
          const partyCredit = inv.type === "purchase" ? inv.total : 0;
          // ON CONFLICT إلزامي — بدونها إعادة المزامنة كانت تضاعف ذمم العميل
          await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                   values (${inv.id + "_party"}, ${inv.type === "sale" ? "accounts_receivable" : "accounts_payable"}, ${inv.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'invoice', ${inv.id}, ${inv.type === "sale" ? "فاتورة مبيعات" : "فاتورة مشتريات"}, ${inv.createdAt})
                   on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit, party_id=EXCLUDED.party_id, description=EXCLUDED.description`;
          if (inv.paidAmount > 0) {
            const payDebit = inv.type === "sale" ? inv.paidAmount : 0;
            const payCredit = inv.type === "purchase" ? inv.paidAmount : 0;
            await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                     values (${inv.id + "_pay"}, 'cash', ${inv.partyId}, ${payDebit - payCredit}, ${payDebit}, ${payCredit}, 'invoice_payment', ${inv.id}, 'سداد فاتورة', ${inv.createdAt})
                     on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit, party_id=EXCLUDED.party_id`;
          }
        }
      }

      // 5.5 Insert Transactions — فقط الصفوف التي ليست مشتقة من فاتورة (لأن الفاتورة أعلاه تكتب _party/_pay)
      // وإلا تتكرر القيود عند كل مزامنة يدوية قديمة.
      for (const t of transactions) {
        const tid = String(t.id || "");
        if (tid.endsWith("_party") || tid.endsWith("_pay") || tid.endsWith("_mov")) continue;
        if (t.documentType === "invoice" || t.documentType === "invoice_payment") continue;
        await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                 values (${t.id}, ${t.cashIn > 0 || t.cashOut > 0 ? "cash" : t.partyType === "customer" ? "accounts_receivable" : "accounts_payable"}, ${t.partyId || null}, ${t.debit - t.credit}, ${t.debit}, ${t.credit}, ${t.documentType}, ${t.documentId}, ${t.description}, ${t.date})
                 on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
      }

      // 6. Insert Vouchers
      for (const v of vouchers) {
        await tx`insert into vouchers (id, voucher_number, type, party_type, party_id, amount, date, payment_method, description, created_at)
                 values (${v.id}, ${v.voucherNumber}, ${v.type}, ${v.partyType}, ${v.partyId || null}, ${v.amount}, ${v.date}, ${v.paymentMethod}, ${v.description}, ${v.createdAt})
                 on conflict (id) do update set amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, description=EXCLUDED.description`;
      }

      // 7. Insert Expenses
      for (const e of expenses) {
        await tx`insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
                 values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})
                 on conflict (id) do update set amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, description=EXCLUDED.description`;
      }
    });
  });

export const addParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    await requirePermission(PERMS.PARTY_WRITE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into parties (id, type, name, phone, address, company, created_at)
                values (${p.id}, ${p.type}, ${p.name}, ${p.phone || null}, ${p.address || null}, ${p.company || null}, ${p.createdAt})
                on conflict (id) do update set name=EXCLUDED.name, phone=EXCLUDED.phone, address=EXCLUDED.address, company=EXCLUDED.company, type=EXCLUDED.type, is_active=true, archived_at=null`;
      const ob = Number(p.openingBalance) || 0;
      if (ob !== 0) {
        const isCustomer = p.type === "customer";
        const debit = isCustomer ? (ob > 0 ? ob : 0) : ob < 0 ? Math.abs(ob) : 0;
        const credit = isCustomer ? (ob < 0 ? Math.abs(ob) : 0) : ob > 0 ? ob : 0;
        const account = isCustomer ? "accounts_receivable" : "accounts_payable";
        await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                 values (${p.id + "_opening"}, ${account}, ${p.id}, ${debit - credit}, ${debit}, ${credit}, 'opening', ${p.id}, 'رصيد افتتاحي', ${p.createdAt})
                 on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit, party_id=EXCLUDED.party_id`;
      }
    });
  });

export const updateParty = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    await requirePermission(PERMS.PARTY_WRITE);
    const sql = await getSql();
    await sql`update parties set name=${p.name}, phone=${p.phone || null}, address=${p.address || null}, company=${p.company || null} where id=${p.id}`;
  });

export const deleteParty = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.PARTY_WRITE);
    const sql = await getSql();
    await sql`update parties set is_active=false, archived_at=now() where id=${data.id}`;
  });

export const addProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    await requirePermission(PERMS.PRODUCT_WRITE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into products (id, name, category, unit, cost_price, selling_price, min_stock, created_at)
               values (${p.id}, ${p.name}, ${p.category}, ${p.unit || null}, ${p.costPrice}, ${p.sellingPrice}, ${p.minQuantity}, ${p.lastUpdated})
               on conflict (id) do update set name=EXCLUDED.name, category=EXCLUDED.category, unit=EXCLUDED.unit, cost_price=EXCLUDED.cost_price, selling_price=EXCLUDED.selling_price, min_stock=EXCLUDED.min_stock`;
      const qty = Number(p.quantity) || 0;
      if (qty !== 0) {
        await tx`insert into warehouse_stock (warehouse_id, product_id, quantity)
                 values (${resolveWarehouseId(p.warehouseId)}, ${p.id}, ${qty})
                 on conflict (warehouse_id, product_id) do update set quantity=EXCLUDED.quantity`;
        await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
                 values (${p.id + "_open"}, ${p.id}, ${resolveWarehouseId(p.warehouseId)}, 'opening', ${qty}, 'product', ${p.id})
                 on conflict (id) do update set quantity=EXCLUDED.quantity`;
      }
    });
  });

export const updateProduct = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: p }) => {
    await requirePermission(PERMS.PRODUCT_WRITE);
    const sql = await getSql();
    await sql`update products set name=${p.name}, category=${p.category}, unit=${p.unit || null}, cost_price=${p.costPrice}, selling_price=${p.sellingPrice}, min_stock=${p.minQuantity} where id=${p.id}`;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.PRODUCT_WRITE);
    const sql = await getSql();
    await sql`update products set is_active=false, archived_at=now() where id=${data.id}`;
  });

export const saveInvoice = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: inv }) => {
    await requirePermission(PERMS.INVOICE_WRITE);
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
      const previousMovements =
        await tx`select product_id, warehouse_id, quantity from inventory_movements where reference_id=${inv.id}`;
      for (const movement of previousMovements as any[]) {
        await tx`update warehouse_stock set quantity=quantity - ${movement.quantity} where warehouse_id=${movement.warehouse_id} and product_id=${movement.product_id}`;
      }
      await tx`delete from inventory_movements where reference_id=${inv.id}`;
      for (const item of inv.items) {
        await tx`insert into invoice_items (id, invoice_id, product_id, name, quantity, unit, unit_price, total)
                 values (${item.id}, ${inv.id}, ${item.inventoryItemId === "SERVICE" ? null : item.inventoryItemId || null}, ${item.name}, ${item.quantity}, ${item.unit || null}, ${item.unitPrice}, ${item.total})`;
      }

      if (inv.isApproved) {
        for (const item of inv.items) {
          if (item.inventoryItemId && item.inventoryItemId !== "SERVICE") {
            const whId = resolveWarehouseId(inv.warehouseId);
            const qty = inv.type === "sale" ? -item.quantity : item.quantity;
            // Server-side warehouse-scoped stock gate (prevents concurrent oversell)
            if (inv.type === "sale") {
              const stockRows =
                await tx`select quantity from warehouse_stock where warehouse_id=${whId} and product_id=${item.inventoryItemId} for update`;
              const available = stockRows.length ? Number(stockRows[0].quantity) : 0;
              if (Number(item.quantity) > available + 1e-9) {
                throw new Error(
                  `INSUFFICIENT_STOCK: المخزن ${whId} — المتاح ${available} المطلوب ${item.quantity}`,
                );
              }
            }
            await tx`insert into inventory_movements (id, product_id, warehouse_id, movement_type, quantity, reference_type, reference_id)
               values (${item.id + "_mov"}, ${item.inventoryItemId}, ${whId}, ${inv.type}, ${qty}, 'invoice', ${inv.id})
               on conflict (id) do update set quantity=EXCLUDED.quantity, movement_type=EXCLUDED.movement_type, warehouse_id=EXCLUDED.warehouse_id`;
            await tx`insert into warehouse_stock (warehouse_id, product_id, quantity)
               values (${whId}, ${item.inventoryItemId}, ${qty})
               on conflict (warehouse_id, product_id) do update set quantity=warehouse_stock.quantity + ${qty}`;
          }
        }

        const partyDebit = inv.type === "sale" ? inv.total : 0;
        const partyCredit = inv.type === "purchase" ? inv.total : 0;

        await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                  values (${inv.id + "_party"}, ${inv.type === "sale" ? "accounts_receivable" : "accounts_payable"}, ${inv.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'invoice', ${inv.id}, ${inv.type === "sale" ? "فاتورة مبيعات" : "فاتورة مشتريات"}, ${inv.createdAt})
                  on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit, party_id=EXCLUDED.party_id`;

        if (inv.paidAmount > 0) {
          const payDebit = inv.type === "sale" ? inv.paidAmount : 0;
          const payCredit = inv.type === "purchase" ? inv.paidAmount : 0;
          await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                     values (${inv.id + "_pay"}, 'cash', ${inv.partyId}, ${payDebit - payCredit}, ${payDebit}, ${payCredit}, 'invoice_payment', ${inv.id}, ${"سداد فاتورة"}, ${inv.createdAt})
                     on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
        }
      }
    });
  });

export const deleteInvoiceApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.INVOICE_DELETE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`delete from financial_transactions where reference_id=${data.id}`;
      const oldMovements =
        await tx`select product_id, warehouse_id, quantity from inventory_movements where reference_id=${data.id}`;
      for (const movement of oldMovements as any[]) {
        await tx`update warehouse_stock set quantity=quantity - ${movement.quantity} where warehouse_id=${movement.warehouse_id} and product_id=${movement.product_id}`;
      }
      await tx`delete from inventory_movements where reference_id=${data.id}`;
      await tx`delete from invoice_items where invoice_id=${data.id}`;
      await tx`delete from invoices where id=${data.id}`;
    });
  });

export const cancelInvoiceApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.INVOICE_CANCEL);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`delete from financial_transactions where reference_id=${data.id}`;
      const oldMovements =
        await tx`select product_id, warehouse_id, quantity from inventory_movements where reference_id=${data.id}`;
      for (const movement of oldMovements as any[]) {
        await tx`update warehouse_stock set quantity=quantity - ${movement.quantity} where warehouse_id=${movement.warehouse_id} and product_id=${movement.product_id}`;
      }
      await tx`delete from inventory_movements where reference_id=${data.id}`;
      await tx`update invoices set is_approved=false, notes=coalesce(notes,'') || ' [CANCELLED]' where id=${data.id}`;
    });
    return { status: "cancelled", id: data.id };
  });

export const saveVoucher = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: v }) => {
    await requirePermission(PERMS.VOUCHER_WRITE);
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
               values (${v.id + "_cash"}, 'cash', ${v.partyId || null}, ${cashDebit - cashCredit}, ${cashDebit}, ${cashCredit}, 'voucher', ${v.id}, ${v.description}, ${v.createdAt})`;

      if (v.partyId) {
        const partyDebit = isReceipt ? 0 : v.amount;
        const partyCredit = isReceipt ? v.amount : 0;
        await tx`insert into financial_transactions (id, account_id, party_id, amount, debit, credit, reference_type, reference_id, description, created_at)
                  values (${v.id + "_party"}, ${v.partyType === "customer" ? "accounts_receivable" : "accounts_payable"}, ${v.partyId}, ${partyDebit - partyCredit}, ${partyDebit}, ${partyCredit}, 'voucher', ${v.id}, ${v.description}, ${v.createdAt})`;
      }
    });
  });

export const deleteVoucherApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.VOUCHER_WRITE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`delete from financial_transactions where reference_id=${data.id}`;
      await tx`delete from vouchers where id=${data.id}`;
    });
  });

export const saveExpense = createServerFn({ method: "POST" })
  .validator((data: Expense) => data)
  .handler(async ({ data: e }) => {
    await requirePermission(PERMS.EXPENSE_WRITE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`insert into expenses (id, category, amount, date, payment_method, type, description, created_at)
               values (${e.id}, ${e.category}, ${e.amount}, ${e.date}, ${e.paymentMethod}, ${e.type}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set category=EXCLUDED.category, amount=EXCLUDED.amount, date=EXCLUDED.date, payment_method=EXCLUDED.payment_method, type=EXCLUDED.type, description=EXCLUDED.description`;
      await tx`delete from financial_transactions where reference_id=${e.id}`;

      await tx`insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${e.id + "_cash"}, 'cash', ${-e.amount}, 0, ${e.amount}, 'expense', ${e.id}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
      await tx`insert into financial_transactions (id, account_id, amount, debit, credit, reference_type, reference_id, description, created_at)
               values (${e.id + "_expense"}, 'purchases', ${e.amount}, ${e.amount}, 0, 'expense', ${e.id}, ${e.description}, ${e.createdAt})
               on conflict (id) do update set amount=EXCLUDED.amount, debit=EXCLUDED.debit, credit=EXCLUDED.credit`;
    });
  });

export const deleteExpenseApi = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.EXPENSE_WRITE);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`delete from financial_transactions where reference_id=${data.id}`;
      await tx`delete from expenses where id=${data.id}`;
    });
  });

export const saveOrganization = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.SETTINGS_WRITE);
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

/**
 * تصفية بيانات العمل التشغيلية من القاعدة (Supabase).
 * تُحذف الفواتير/الأطراف/المخزون/القيود/الطابور — مع الإبقاء على:
 * المستخدمين، الأدوار، الصلاحيات، الموظفين، وملف المؤسسة.
 */
export const resetDatabase = createServerFn({ method: "POST" }).handler(async () => {
  // This operation permanently deletes business data; never broaden it to
  // settings.write because that would make ordinary settings administrators
  // destructive-data administrators as well.
  await requirePermission(PERMS.DB_RESET);
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    // ترتيب يحترم المفاتيح الأجنبية الشائعة
    await tx`delete from financial_transactions`;
    await tx`delete from inventory_movements`;
    try {
      await tx`delete from warehouse_stock`;
    } catch {
      /* الجدول قد لا يوجد في بيئات قديمة */
    }
    await tx`delete from invoice_items`;
    await tx`delete from invoices`;
    await tx`delete from vouchers`;
    await tx`delete from expenses`;
    await tx`delete from products`;
    await tx`delete from parties`;
    try {
      await tx`delete from processed_operations`;
    } catch {
      /* optional */
    }
    try {
      await tx`delete from sync_outbox`;
    } catch {
      /* optional */
    }
    try {
      await tx`delete from sync_conflicts`;
    } catch {
      /* optional */
    }
    try {
      await tx`delete from audit_events`;
    } catch {
      /* optional */
    }
    // أعد إنشاء طرف PLACEHOLDER للتوريد المخزني إن لزم
    try {
      await tx`
        insert into parties (id, type, name, phone, address, created_at)
        values ('PENDING_RECEIPT', 'supplier', 'مورد توريد مخزني - بانتظار تحديد المورد', '-', '-', now())
        on conflict (id) do nothing
      `;
    } catch {
      /* ignore */
    }
  });
  return { status: "ok", cleared: true };
});

// ─── Outbox / Idempotent operation application ───────────────────────────────

export const applyOutboxOperation = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: op }) => {
    await requireUserId();
    const sql = await getSql();
    const operationId = String(op.operationId || "");
    const operationType = String(op.operationType || "");
    if (!operationId || !operationType) {
      return { status: "error", reason: "missing_operation_id" };
    }

    // Idempotency gate — already fully applied → success without re-effect.
    const existing = await sql`
      select operation_id, claim_status
      from processed_operations
      where operation_id = ${operationId}
      limit 1
    `;
    if (existing.length > 0) {
      const status = String((existing[0] as any).claim_status || "applied");
      // applied = ACK نهائي؛ processing = عملية جارية من جهاز آخر أو نفس الجهاز
      return { status: status === "applied" ? "duplicate" : "duplicate", operationId };
    }

    await sql.transaction(async (tx) => {
      // سجّل المطالبة بحالة processing داخل نفس المعاملة (الافتراضي في الهجرة 0011).
      // completeOutboxOperation يحوّلها إلى applied بعد نجاح العملية التجارية.
      await tx`insert into processed_operations (operation_id, operation_type, document_id, org_id, device_id, claim_status, result_summary)
               values (
                 ${operationId},
                 ${operationType},
                 ${op.documentId || null},
                 ${op.orgId || "default_org"},
                 ${op.deviceId || null},
                 'processing',
                 ${JSON.stringify({ claimed: true })}::jsonb
               )
               on conflict (operation_id) do nothing`;

      const claimed = await tx`
        select operation_id, claim_status, device_id
        from processed_operations
        where operation_id = ${operationId}
        limit 1
      `;
      if (!claimed.length) {
        return;
      }
      // إذا فاز جهاز/طلب آخر بالمطالبة فلا نكتب تدقيقًا مكررًا هنا.
      if (
        String((claimed[0] as any).device_id || "") !== String(op.deviceId || "") &&
        String((claimed[0] as any).claim_status || "") === "applied"
      ) {
        return;
      }

      if (op.audit) {
        const a = op.audit;
        await tx`insert into audit_events (audit_id, org_id, device_id, user_id, operation_id, entity_type, entity_id, action, before_data, after_data, metadata)
                 values (
                   ${operationId + "__audit"},
                   ${op.orgId || "default_org"},
                   ${op.deviceId || null},
                   ${op.userId || null},
                   ${operationId},
                   ${a.entityType || "unknown"},
                   ${a.entityId || op.documentId || "unknown"},
                   ${a.action || operationType},
                   ${a.before ? JSON.stringify(a.before) : null}::jsonb,
                   ${a.after ? JSON.stringify(a.after) : null}::jsonb,
                   ${JSON.stringify({ operationType })}::jsonb
                 )
                 on conflict (audit_id) do nothing`;
      }
    });

    return { status: "applied", operationId };
  });

export const recordAuditEvent = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data: a }) => {
    await requirePermission(PERMS.AUDIT_READ);
    const sql = await getSql();
    await sql`insert into audit_events (audit_id, org_id, device_id, user_id, operation_id, entity_type, entity_id, action, before_data, after_data, metadata)
              values (
                ${a.auditId},
                ${a.orgId || "default_org"},
                ${a.deviceId || null},
                ${a.userId || null},
                ${a.operationId || null},
                ${a.entityType},
                ${a.entityId},
                ${a.action},
                ${a.before ? JSON.stringify(a.before) : null}::jsonb,
                ${a.after ? JSON.stringify(a.after) : null}::jsonb,
                ${a.metadata ? JSON.stringify(a.metadata) : null}::jsonb
              )
              on conflict (audit_id) do nothing`;
    return { status: "ok" };
  });

export const listAuditEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission(PERMS.AUDIT_READ);
  const sql = await getSql();
  try {
    const rows = await sql`
        select audit_id, org_id, device_id, user_id, operation_id, entity_type, entity_id, action,
               before_data, after_data, metadata, created_at
        from audit_events
        order by created_at desc
        limit 200`;
    return rows as any[];
  } catch {
    return [];
  }
});
