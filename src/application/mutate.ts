/**
 * Application orchestration: UI → mutate* → Domain → local projection + Outbox.
 * operation_id format: `{operationType}:{documentId}`
 * Distinct operation types on the same document remain independent
 * (e.g. invoice.save:inv1 vs invoice.approve:inv1 vs invoice.delete:inv1).
 */
import type {
  AppData,
  Customer,
  Expense,
  InventoryItem,
  Invoice,
  Supplier,
  Voucher,
} from "../lib/types.ts";
import {
  applyExpenseEffects,
  applyInvoiceEffects,
  applyVoucherEffects,
  approveInvoiceOp,
  issueMaterialOp,
  cancelInvoiceOp,
} from "../domain/operations.ts";
import { err, ok, type Result } from "../domain/result.ts";
import { canIssueFromWarehouse, resolveWarehouseId } from "../domain/inventory.ts";
import { assertLocalPermission } from "./permissions.ts";
import {
  createOutboxItem,
  type OutboxItem,
  type OperationType,
} from "../domain/outbox.ts";
import { buildAuditEvent, type AuditEvent } from "../domain/audit.ts";
import { getDeviceId } from "../domain/device.ts";
import { ledgerRowId } from "../domain/idempotency.ts";

export type MutationBundle = {
  state: AppData;
  outbox: OutboxItem;
  audit: AuditEvent;
  operationId: string;
};

/** Deterministic id: same type+document = same op (retry-safe). Different types = different ops. */
export function makeOperationId(
  operationType: OperationType,
  documentId: string,
  suffix?: string,
): string {
  return suffix
    ? `${operationType}:${documentId}:${suffix}`
    : `${operationType}:${documentId}`;
}

function bundle(
  state: AppData,
  operationType: OperationType,
  documentId: string,
  payload: unknown,
  entityType: string,
  action: string,
  before?: unknown,
  after?: unknown,
  suffix?: string,
): MutationBundle {
  const operationId = makeOperationId(operationType, documentId, suffix);
  const deviceId = getDeviceId();
  const outbox = createOutboxItem({
    operationId,
    operationType,
    documentId,
    deviceId,
    payload,
    audit: { entityType, entityId: documentId, action, before, after },
  });
  const audit = buildAuditEvent({
    operationId,
    deviceId,
    entityType,
    entityId: documentId,
    action,
    before,
    after,
  });
  return { state, outbox, audit, operationId };
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export function mutateSaveInvoice(
  state: AppData,
  invoice: Invoice,
  previous?: Invoice,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, invoice.isApproved ? "invoice.approve" : "invoice.write");
  if (!_perm.ok) return _perm;

  if (!invoice.id) return err("VALIDATION", "معرّف الفاتورة مطلوب");
  if (!invoice.items?.length && invoice.isApproved) {
    return err("VALIDATION", "لا يمكن اعتماد فاتورة بلا بنود");
  }
    // Stock gate: SELECTED warehouse only (never global sum across warehouses)
  if (
    invoice.isApproved &&
    !previous?.isApproved &&
    invoice.type === "sale" &&
    invoice.invoiceType !== "SERVICE"
  ) {
    const wh = resolveWarehouseId(invoice.warehouseId || state.defaultWarehouseId);
    for (const line of invoice.items) {
      if (!line.inventoryItemId || line.inventoryItemId === "SERVICE") continue;
      const check = canIssueFromWarehouse(
        state.warehouseStocks,
        wh,
        line.inventoryItemId,
        line.quantity,
      );
      if (!check.ok) {
        return err(
          "INSUFFICIENT_STOCK",
          `الكمية غير كافية للمادة: ${line.name} في المخزن (متاح ${check.available})`,
        );
      }
    }
  }
  let next = state;
  const exists = state.invoices.some((i) => i.id === invoice.id);
  next = {
    ...next,
    invoices: exists
      ? state.invoices.map((i) => (i.id === invoice.id ? invoice : i))
      : [invoice, ...state.invoices],
  };
  if (previous?.isApproved) next = applyInvoiceEffects(next, previous, -1);
  if (invoice.isApproved) next = applyInvoiceEffects(next, invoice, 1);

  const opType: OperationType =
    invoice.isApproved && !previous?.isApproved ? "invoice.approve" : "invoice.save";
  const action =
    invoice.isApproved && !previous?.isApproved ? "approve" : "save";

  return ok(
    bundle(next, opType, invoice.id, invoice, "invoice", action, previous, invoice),
  );
}

export function mutateApproveInvoice(
  state: AppData,
  invoiceId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "invoice.approve");
  if (!_perm.ok) return _perm;

  const result = approveInvoiceOp(state, invoiceId);
  if (!result.ok) return result;
  return ok(
    bundle(
      result.value.state,
      "invoice.approve",
      invoiceId,
      result.value.invoice,
      "invoice",
      "approve",
      state.invoices.find((i) => i.id === invoiceId),
      result.value.invoice,
    ),
  );
}

export function mutateIssueMaterial(
  state: AppData,
  invoice: Invoice,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "invoice.write");
  if (!_perm.ok) return _perm;

  const result = issueMaterialOp(state, invoice);
  if (!result.ok) return result;
  return ok(
    bundle(
      result.value.state,
      "invoice.save",
      invoice.id,
      result.value.invoice,
      "invoice",
      "issue",
      undefined,
      result.value.invoice,
    ),
  );
}

export function mutateDeleteInvoice(
  state: AppData,
  invoiceId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "invoice.delete");
  if (!_perm.ok) return _perm;

  const old = state.invoices.find((i) => i.id === invoiceId);
  if (!old) return err("NOT_FOUND", "الفاتورة غير موجودة");
  let next = applyInvoiceEffects(state, old, -1);
  next = { ...next, invoices: next.invoices.filter((i) => i.id !== invoiceId) };
  return ok(
    bundle(next, "invoice.delete", invoiceId, { id: invoiceId }, "invoice", "delete", old),
  );
}


export function mutateCancelInvoice(
  state: AppData,
  invoiceId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "invoice.cancel");
  if (!_perm.ok) return _perm;

  const result = cancelInvoiceOp(state, invoiceId);
  if (!result.ok) return result;
  return ok(
    bundle(
      result.value.state,
      "invoice.cancel",
      invoiceId,
      result.value.invoice,
      "invoice",
      "cancel",
      state.invoices.find((i) => i.id === invoiceId),
      result.value.invoice,
    ),
  );
}

// ─── Voucher / Expense ───────────────────────────────────────────────────────

export function mutateSaveVoucher(
  state: AppData,
  voucher: Voucher,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "voucher.write");
  if (!_perm.ok) return _perm;

  if (!voucher.id) return err("VALIDATION", "معرّف السند مطلوب");
  if (!(voucher.amount > 0)) return err("VALIDATION", "مبلغ السند يجب أن يكون أكبر من صفر");
  let next: AppData = {
    ...state,
    vouchers: [voucher, ...state.vouchers.filter((v) => v.id !== voucher.id)],
  };
  const old = state.vouchers.find((v) => v.id === voucher.id);
  if (old) next = applyVoucherEffects(next, old, -1);
  next = applyVoucherEffects(next, voucher, 1);
  return ok(
    bundle(next, "voucher.save", voucher.id, voucher, "voucher", "save", old, voucher),
  );
}

export function mutateDeleteVoucher(
  state: AppData,
  voucherId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "voucher.write");
  if (!_perm.ok) return _perm;

  const old = state.vouchers.find((v) => v.id === voucherId);
  if (!old) return err("NOT_FOUND", "السند غير موجود");
  let next = applyVoucherEffects(state, old, -1);
  next = { ...next, vouchers: next.vouchers.filter((v) => v.id !== voucherId) };
  return ok(
    bundle(next, "voucher.delete", voucherId, { id: voucherId }, "voucher", "delete", old),
  );
}

export function mutateSaveExpense(
  state: AppData,
  expense: Expense,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "expense.write");
  if (!_perm.ok) return _perm;

  if (!expense.id) return err("VALIDATION", "معرّف المصروف مطلوب");
  if (!(expense.amount > 0)) return err("VALIDATION", "مبلغ المصروف يجب أن يكون أكبر من صفر");
  let next: AppData = {
    ...state,
    expenses: [expense, ...state.expenses.filter((e) => e.id !== expense.id)],
  };
  const old = state.expenses.find((e) => e.id === expense.id);
  if (old) next = applyExpenseEffects(next, old, -1);
  next = applyExpenseEffects(next, expense, 1);
  return ok(
    bundle(next, "expense.save", expense.id, expense, "expense", "save", old, expense),
  );
}

export function mutateDeleteExpense(
  state: AppData,
  expenseId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "expense.write");
  if (!_perm.ok) return _perm;

  const old = state.expenses.find((e) => e.id === expenseId);
  if (!old) return err("NOT_FOUND", "المصروف غير موجود");
  let next = applyExpenseEffects(state, old, -1);
  next = { ...next, expenses: next.expenses.filter((e) => e.id !== expenseId) };
  return ok(
    bundle(next, "expense.delete", expenseId, { id: expenseId }, "expense", "delete", old),
  );
}

// ─── Party / Product (master data) ───────────────────────────────────────────

export function mutateUpsertCustomer(
  state: AppData,
  customer: Customer,
  isNew: boolean,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "party.write");
  if (!_perm.ok) return _perm;

  if (!customer.name?.trim()) return err("VALIDATION", "اسم العميل مطلوب");
  const prev = state.customers.find((c) => c.id === customer.id);
  let next: AppData = {
    ...state,
    customers: isNew
      ? [customer, ...state.customers]
      : state.customers.map((c) => (c.id === customer.id ? customer : c)),
  };
  // Opening balance only on create when non-zero
  if (isNew && (Number(customer.balance) || 0) !== 0) {
    const ob = Number(customer.balance);
    const trx = {
      id: ledgerRowId(customer.id, "opening"),
      date: customer.createdAt,
      documentId: customer.id,
      documentNumber: `OB-${customer.id.slice(-6)}`,
      documentType: "voucher" as const,
      partyId: customer.id,
      partyType: "customer" as const,
      debit: ob > 0 ? ob : 0,
      credit: ob < 0 ? Math.abs(ob) : 0,
      cashIn: 0,
      cashOut: 0,
      description: "رصيد افتتاحي",
    };
    next = { ...next, transactions: [trx, ...next.transactions] };
  }
  const payload = {
    id: customer.id,
    type: "customer",
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    company: null,
    createdAt: customer.createdAt,
    openingBalance: isNew ? Number(customer.balance) || 0 : undefined,
  };
  return ok(
    bundle(
      next,
      isNew && (Number(customer.balance) || 0) !== 0 ? "opening.balance" : "party.upsert",
      customer.id,
      payload,
      "party",
      isNew ? "create" : "update",
      prev,
      customer,
    ),
  );
}

export function mutateUpsertSupplier(
  state: AppData,
  supplier: Supplier,
  isNew: boolean,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "party.write");
  if (!_perm.ok) return _perm;

  if (!supplier.name?.trim()) return err("VALIDATION", "اسم المورد مطلوب");
  const prev = state.suppliers.find((s) => s.id === supplier.id);
  let next: AppData = {
    ...state,
    suppliers: isNew
      ? [supplier, ...state.suppliers]
      : state.suppliers.map((s) => (s.id === supplier.id ? supplier : s)),
  };
  if (isNew && (Number(supplier.balance) || 0) !== 0) {
    const ob = Number(supplier.balance);
    const trx = {
      id: ledgerRowId(supplier.id, "opening"),
      date: supplier.createdAt,
      documentId: supplier.id,
      documentNumber: `OB-${supplier.id.slice(-6)}`,
      documentType: "voucher" as const,
      partyId: supplier.id,
      partyType: "supplier" as const,
      debit: ob < 0 ? Math.abs(ob) : 0,
      credit: ob > 0 ? ob : 0,
      cashIn: 0,
      cashOut: 0,
      description: "رصيد افتتاحي",
    };
    next = { ...next, transactions: [trx, ...next.transactions] };
  }
  const payload = {
    id: supplier.id,
    type: "supplier",
    name: supplier.name,
    phone: supplier.phone,
    address: null,
    company: supplier.company,
    createdAt: supplier.createdAt,
    openingBalance: isNew ? Number(supplier.balance) || 0 : undefined,
  };
  return ok(
    bundle(
      next,
      isNew && (Number(supplier.balance) || 0) !== 0 ? "opening.balance" : "party.upsert",
      supplier.id,
      payload,
      "party",
      isNew ? "create" : "update",
      prev,
      supplier,
    ),
  );
}

export function mutateDeleteParty(
  state: AppData,
  partyId: string,
  kind: "customer" | "supplier",
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "party.write");
  if (!_perm.ok) return _perm;

  const prev =
    kind === "customer"
      ? state.customers.find((c) => c.id === partyId)
      : state.suppliers.find((s) => s.id === partyId);
  if (!prev) return err("NOT_FOUND", "الطرف غير موجود");
  let next: AppData = { ...state };
  if (kind === "customer") {
    next = {
      ...next,
      customers: next.customers.filter((c) => c.id !== partyId),
      transactions: next.transactions.filter(
        (t) => !(t.partyId === partyId && t.description === "رصيد افتتاحي"),
      ),
    };
  } else {
    next = {
      ...next,
      suppliers: next.suppliers.filter((s) => s.id !== partyId),
      transactions: next.transactions.filter(
        (t) => !(t.partyId === partyId && t.description === "رصيد افتتاحي"),
      ),
    };
  }
  return ok(
    bundle(next, "party.delete", partyId, { id: partyId }, "party", "delete", prev),
  );
}

export function mutateUpsertProduct(
  state: AppData,
  item: InventoryItem,
  isNew: boolean,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "product.write");
  if (!_perm.ok) return _perm;

  if (!item.name?.trim()) return err("VALIDATION", "اسم المادة مطلوب");
  const prev = state.inventory.find((i) => i.id === item.id);
  const next: AppData = {
    ...state,
    inventory: isNew
      ? [item, ...state.inventory]
      : state.inventory.map((i) => (i.id === item.id ? item : i)),
  };
  const payload = {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    costPrice: item.costPrice,
    sellingPrice: item.sellingPrice,
    minQuantity: item.minQuantity,
    lastUpdated: item.lastUpdated,
    quantity: isNew ? item.quantity || 0 : undefined,
    warehouseId: item.warehouseId,
  };
  return ok(
    bundle(
      next,
      isNew && (item.quantity || 0) !== 0 ? "opening.stock" : "product.upsert",
      item.id,
      payload,
      "product",
      isNew ? "create" : "update",
      prev,
      item,
    ),
  );
}

export function mutateDeleteProduct(
  state: AppData,
  productId: string,
): Result<MutationBundle> {
  const _perm = assertLocalPermission(state.userPermissions, "product.write");
  if (!_perm.ok) return _perm;

  const prev = state.inventory.find((i) => i.id === productId);
  if (!prev) return err("NOT_FOUND", "المادة غير موجودة");
  const next: AppData = {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== productId),
  };
  return ok(
    bundle(next, "product.delete", productId, { id: productId }, "product", "delete", prev),
  );
}
