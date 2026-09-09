/**
 * Pure domain operations — no I/O, no React, no Zustand.
 * Store / repository call these then persist.
 *
 * Architecture:
 *   Business Event → Domain Operation → Patch(AppData)
 *   Server: Atomic SQL transaction mirrors the same effects with stable IDs.
 */
import type {
  AppData,
  Expense,
  Invoice,
  InventoryItem,
  Transaction,
  Voucher,
} from "../lib/types.ts";
import { assertTransition, invoiceLifecycle } from "./document-state.ts";
import { err, ok, type Result } from "./result.ts";
import { canIssueFromWarehouse, patchWarehouseStockRows, resolveWarehouseId, DEFAULT_WAREHOUSE_ID } from "./inventory.ts";
import { ledgerRowId } from "./idempotency.ts";

function dropDocTransactions(state: AppData, documentId: string): AppData {
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.documentId !== documentId),
  };
}

function patchPartyBalance(
  state: AppData,
  kind: "customer" | "supplier",
  id: string | undefined,
  delta: number,
): AppData {
  if (!id || delta === 0) return state;
  if (kind === "customer") {
    return {
      ...state,
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, balance: c.balance + delta } : c,
      ),
    };
  }
  return {
    ...state,
    suppliers: state.suppliers.map((s) =>
      s.id === id ? { ...s, balance: s.balance + delta } : s,
    ),
  };
}

function patchInventory(
  state: AppData,
  itemId: string | undefined,
  qtyDelta: number,
  warehouseId?: string,
): AppData {
  if (!itemId || qtyDelta === 0 || itemId === "SERVICE") return state;
  const wh = resolveWarehouseId(warehouseId || state.defaultWarehouseId);
  const rows = patchWarehouseStockRows(state.warehouseStocks || [], wh, itemId, qtyDelta);
  // Aggregate inventory.quantity = sum across warehouses for display compatibility
  const totalForProduct = rows
    .filter((r) => r.productId === itemId)
    .reduce((s, r) => s + r.quantity, 0);
  return {
    ...state,
    warehouseStocks: rows,
    inventory: state.inventory.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity: totalForProduct,
            lastUpdated: new Date().toISOString(),
          }
        : item,
    ),
  };
}

function upsertLedger(state: AppData, trx: Transaction): AppData {
  return {
    ...state,
    transactions: [
      trx,
      ...state.transactions.filter((t) => t.documentId !== trx.documentId),
    ],
  };
}

/** Apply or reverse approved invoice effects (local projection). */
export function applyInvoiceEffects(
  state: AppData,
  invoice: Invoice,
  sign: 1 | -1,
): AppData {
  if (!invoice.isApproved) return state;

  let next = state;
  if (sign === -1) next = dropDocTransactions(next, invoice.id);

  const isSale = invoice.type === "sale";
  const debit = isSale ? invoice.total : invoice.paidAmount;
  const credit = isSale ? invoice.paidAmount : invoice.total;
  const cashIn = isSale ? invoice.paidAmount : 0;
  const cashOut = isSale ? 0 : invoice.paidAmount;
  const balanceChange = isSale ? debit - credit : credit - debit;

  if (sign === 1) {
    const trx: Transaction = {
      id: ledgerRowId(invoice.id, "ledger"),
      date: invoice.date,
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber,
      documentType: "invoice",
      partyId: invoice.partyId,
      partyType: isSale ? "customer" : "supplier",
      debit,
      credit,
      cashIn,
      cashOut,
      paymentMethod: invoice.paymentMethod || "cash",
      description:
        invoice.invoiceType === "SERVICE"
          ? "فاتورة خدمة تطريز"
          : invoice.invoiceType === "ISSUE"
            ? "أمر صرف مخزني"
            : isSale
              ? "فاتورة مبيعات"
              : "فاتورة مشتريات",
    };
    next = upsertLedger(next, trx);
  }

  next = patchPartyBalance(
    next,
    isSale ? "customer" : "supplier",
    invoice.partyId,
    balanceChange * sign,
  );

  if (invoice.invoiceType !== "SERVICE") {
    const wh = resolveWarehouseId(invoice.warehouseId || next.defaultWarehouseId);
    for (const line of invoice.items) {
      const qtyChange = isSale ? -line.quantity : line.quantity;
      next = patchInventory(next, line.inventoryItemId, qtyChange * sign, wh);
    }
  }

  return next;
}

export function applyVoucherEffects(
  state: AppData,
  voucher: Voucher,
  sign: 1 | -1,
): AppData {
  let next = state;
  if (sign === -1) next = dropDocTransactions(next, voucher.id);

  let debit = 0;
  let credit = 0;
  let cashIn = 0;
  let cashOut = 0;

  if (voucher.partyType === "customer") {
    if (voucher.type === "receipt") {
      credit = voucher.amount;
      cashIn = voucher.amount;
    } else {
      debit = voucher.amount;
      cashOut = voucher.amount;
    }
  } else if (voucher.partyType === "supplier") {
    if (voucher.type === "payment") {
      debit = voucher.amount;
      cashOut = voucher.amount;
    } else {
      credit = voucher.amount;
      cashIn = voucher.amount;
    }
  } else if (voucher.type === "receipt") {
    cashIn = voucher.amount;
  } else {
    cashOut = voucher.amount;
  }

  if (sign === 1) {
    const trx: Transaction = {
      id: ledgerRowId(voucher.id, "ledger"),
      date: voucher.date,
      documentId: voucher.id,
      documentNumber: voucher.voucherNumber,
      documentType: "voucher",
      partyId: voucher.partyId,
      partyType: voucher.partyType,
      debit,
      credit,
      cashIn,
      cashOut,
      paymentMethod: voucher.paymentMethod,
      description:
        voucher.description ||
        (voucher.type === "receipt" ? "سند قبض" : "سند صرف"),
    };
    next = upsertLedger(next, trx);
  }

  if (voucher.partyId && voucher.partyType !== "other") {
    const balanceChange =
      voucher.partyType === "customer" ? debit - credit : credit - debit;
    next = patchPartyBalance(
      next,
      voucher.partyType,
      voucher.partyId,
      balanceChange * sign,
    );
  }

  return next;
}

export function applyExpenseEffects(
  state: AppData,
  expense: Expense,
  sign: 1 | -1,
): AppData {
  let next = state;
  if (sign === -1) next = dropDocTransactions(next, expense.id);

  if (sign === 1) {
    const trx: Transaction = {
      id: ledgerRowId(expense.id, "ledger"),
      date: expense.date,
      documentId: expense.id,
      documentNumber: expense.id.slice(-8),
      documentType: "expense",
      debit: expense.amount,
      credit: 0,
      cashIn: 0,
      cashOut: expense.amount,
      paymentMethod: expense.paymentMethod,
      description:
        expense.description ||
        (expense.type === "work" ? "مصروف عمل" : "مصروف شخصي"),
    };
    next = upsertLedger(next, trx);
  }

  return next;
}

/** Approve draft invoice — state machine guarded. */
export function approveInvoiceOp(
  state: AppData,
  invoiceId: string,
): Result<{ state: AppData; invoice: Invoice }> {
  const inv = state.invoices.find((x) => x.id === invoiceId);
  if (!inv) return err("NOT_FOUND", "الفاتورة غير موجودة");
  const from = invoiceLifecycle(inv.isApproved);
  const gate = assertTransition(from, "approved");
  if (!gate.ok) return err("INVALID_STATE", gate.message);
  if (!inv.items.length) return err("VALIDATION", "الفاتورة بلا بنود");
  if (inv.total < 0) return err("VALIDATION", "إجمالي الفاتورة غير صالح");

  // Stock check against SELECTED warehouse only (not global sum)
  if (inv.type === "sale" && inv.invoiceType !== "SERVICE") {
    const wh = resolveWarehouseId(inv.warehouseId || state.defaultWarehouseId);
    for (const line of inv.items) {
      if (!line.inventoryItemId || line.inventoryItemId === "SERVICE") continue;
      const item = state.inventory.find((i) => i.id === line.inventoryItemId);
      const check = canIssueFromWarehouse(
        state.warehouseStocks,
        wh,
        line.inventoryItemId,
        line.quantity,
      );
      if (!check.ok) {
        return err(
          "INSUFFICIENT_STOCK",
          `لا يمكن صرف ${line.quantity} من ${line.name || item?.name || "مادة"} من المخزن — المتاح ${check.available}`,
        );
      }
    }
  }

  const updated: Invoice = { ...inv, isApproved: true };
  let next: AppData = {
    ...state,
    invoices: state.invoices.map((x) => (x.id === invoiceId ? updated : x)),
  };
  next = applyInvoiceEffects(next, updated, 1);
  return ok({ state: next, invoice: updated });
}

/** Record warehouse issue as approved ISSUE invoice (validated). */
export function issueMaterialOp(
  state: AppData,
  invoice: Invoice,
): Result<{ state: AppData; invoice: Invoice }> {
  if (invoice.invoiceType !== "ISSUE") {
    return err("VALIDATION", "المستند ليس أمر صرف");
  }
  if (!invoice.items.length) return err("VALIDATION", "لا توجد مواد للصرف");

  for (const line of invoice.items) {
    if (!line.inventoryItemId) {
      return err("VALIDATION", "بند بدون مادة");
    }
    const item = state.inventory.find((i) => i.id === line.inventoryItemId);
    const wh = resolveWarehouseId(invoice.warehouseId || state.defaultWarehouseId);
    const check = canIssueFromWarehouse(
      state.warehouseStocks,
      wh,
      line.inventoryItemId,
      line.quantity,
    );
    if (!check.ok) {
      return err(
        "INSUFFICIENT_STOCK",
        `لا يمكن صرف ${line.quantity} من ${line.name || item?.name || "مادة"} من المخزن — المتاح ${check.available}`,
      );
    }
  }

  const approved: Invoice = { ...invoice, isApproved: true, type: "sale" };
  let next: AppData = {
    ...state,
    invoices: [approved, ...state.invoices.filter((i) => i.id !== approved.id)],
  };
  next = applyInvoiceEffects(next, approved, 1);
  return ok({ state: next, invoice: approved });
}

/** Opening stock on new product — quantity is the initial projection. */
export function addProductWithOpeningStock(
  state: AppData,
  item: InventoryItem,
): Result<AppData> {
  if (!item.name.trim()) return err("VALIDATION", "اسم المادة مطلوب");
  if (state.inventory.some((x) => x.id === item.id)) {
    return err("CONFLICT", "المادة موجودة مسبقًا");
  }
  return ok({ ...state, inventory: [item, ...state.inventory] });
}

/** Double-apply safety: applying same approved invoice twice must not double stock. */
export function applyInvoiceIdempotent(
  state: AppData,
  invoice: Invoice,
): AppData {
  if (!invoice.isApproved) return state;
  // Reverse any prior effect for this document, then apply once.
  let next = applyInvoiceEffects(state, invoice, -1);
  next = applyInvoiceEffects(next, invoice, 1);
  return next;
}


/** Cancel an approved invoice: reverse ledger+stock, keep document, mark cancelled. */
export function cancelInvoiceOp(
  state: AppData,
  invoiceId: string,
): Result<{ state: AppData; invoice: Invoice }> {
  const inv = state.invoices.find((x) => x.id === invoiceId);
  if (!inv) return err("NOT_FOUND", "الفاتورة غير موجودة");
  if (inv.isCancelled) return err("INVALID_STATE", "المستند ملغى مسبقًا");
  const from = invoiceLifecycle(inv.isApproved, inv.isCancelled);
  const gate = assertTransition(from, "cancelled");
  if (!gate.ok) return err("INVALID_STATE", gate.message);

  // Only approved docs produce reversible economic effects
  let next = state;
  if (inv.isApproved) {
    next = applyInvoiceEffects(next, inv, -1);
  }
  const updated: Invoice = {
    ...inv,
    isApproved: false,
    isCancelled: true,
    notes: [inv.notes, "[CANCELLED]"].filter(Boolean).join(" "),
  };
  next = {
    ...next,
    invoices: next.invoices.map((x) => (x.id === invoiceId ? updated : x)),
  };
  return ok({ state: next, invoice: updated });
}
