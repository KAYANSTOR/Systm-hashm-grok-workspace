import type {
  AppData,
  Expense,
  Invoice,
  Transaction,
  Voucher,
} from "./types";
import { uid } from "./utils";

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
): AppData {
  if (!itemId || qtyDelta === 0 || itemId === "SERVICE") return state;
  return {
    ...state,
    inventory: state.inventory.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity: item.quantity + qtyDelta,
            lastUpdated: new Date().toISOString(),
          }
        : item,
    ),
  };
}

function dropDocTransactions(state: AppData, documentId: string): AppData {
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.documentId !== documentId),
  };
}

export function applyInvoice(state: AppData, invoice: Invoice, sign: 1 | -1): AppData {
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
      id: uid("trx"),
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
      paymentMethod: "cash",
      description:
        invoice.invoiceType === "SERVICE"
          ? "فاتورة خدمة تطريز"
          : isSale
            ? "فاتورة مبيعات"
            : "فاتورة مشتريات",
    };
    next = { ...next, transactions: [trx, ...next.transactions] };
  }

  next = patchPartyBalance(
    next,
    isSale ? "customer" : "supplier",
    invoice.partyId,
    balanceChange * sign,
  );

  if (invoice.invoiceType !== "SERVICE") {
    for (const line of invoice.items) {
      const qtyChange = isSale ? -line.quantity : line.quantity;
      next = patchInventory(next, line.inventoryItemId, qtyChange * sign);
    }
  }

  return next;
}

export function applyVoucher(state: AppData, voucher: Voucher, sign: 1 | -1): AppData {
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
      id: uid("trx"),
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
    next = { ...next, transactions: [trx, ...next.transactions] };
  }

  if (voucher.partyId && voucher.partyType !== "other") {
    const balanceChange =
      voucher.partyType === "customer" ? debit - credit : credit - debit;
    next = patchPartyBalance(next, voucher.partyType, voucher.partyId, balanceChange * sign);
  }

  return next;
}

export function applyExpense(state: AppData, expense: Expense, sign: 1 | -1): AppData {
  let next = state;
  if (sign === -1) next = dropDocTransactions(next, expense.id);

  if (sign === 1) {
    const seq =
      next.transactions.filter((t) => t.documentType === "expense").length + 1;
    const trx: Transaction = {
      id: uid("trx"),
      date: expense.date,
      documentId: expense.id,
      documentNumber: `EXP-${String(seq).padStart(4, "0")}`,
      documentType: "expense",
      debit: 0,
      credit: 0,
      cashIn: 0,
      cashOut: expense.amount,
      paymentMethod: expense.paymentMethod,
      description:
        expense.description ||
        (expense.type === "work" ? "مصروف عمل" : "مصروف شخصي"),
    };
    next = { ...next, transactions: [trx, ...next.transactions] };
  }

  return next;
}

export function cashBalance(
  transactions: Transaction[],
  method?: string,
): number {
  return transactions.reduce((sum, t) => {
    if (method && (t.paymentMethod || "cash") !== method) return sum;
    return sum + (t.cashIn || 0) - (t.cashOut || 0);
  }, 0);
}
