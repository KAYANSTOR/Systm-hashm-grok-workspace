import type { PartyKind, Transaction } from "../lib/types.ts";
import { moneyEquals } from "./money.ts";

/**
 * CANONICAL financial view is derived from Transaction rows
 * (which mirror server financial_transactions after fetch/sync).
 *
 * Party balances and cash are NEVER independent sources of truth —
 * they are projections recomputed from the ledger.
 */

export type PartyBalanceMap = Map<string, number>;

/**
 * Customer convention: positive balance = customer owes us (AR).
 * Supplier convention: positive balance = we owe supplier (AP).
 *
 * Local Transaction model uses debit/credit on a single aggregated row per document.
 * rebuildPartyBalances applies the same rules as applyInvoice/applyVoucher.
 */
export function rebuildPartyBalances(
  transactions: Transaction[],
): { customers: PartyBalanceMap; suppliers: PartyBalanceMap } {
  const customers = new Map<string, number>();
  const suppliers = new Map<string, number>();

  for (const t of transactions) {
    if (!t.partyId || !t.partyType || t.partyType === "other") continue;
    const debit = Number(t.debit) || 0;
    const credit = Number(t.credit) || 0;
    if (t.partyType === "customer") {
      // balanceChange = debit - credit
      customers.set(t.partyId, (customers.get(t.partyId) || 0) + debit - credit);
    } else if (t.partyType === "supplier") {
      // balanceChange = credit - debit
      suppliers.set(t.partyId, (suppliers.get(t.partyId) || 0) + credit - debit);
    }
  }
  return { customers, suppliers };
}

export function rebuildCashBalance(
  transactions: Transaction[],
  method?: string,
): number {
  return transactions.reduce((sum, t) => {
    if (method && (t.paymentMethod || "cash") !== method) return sum;
    return sum + (Number(t.cashIn) || 0) - (Number(t.cashOut) || 0);
  }, 0);
}

/** Statement identity check for a party. */
export function statementClosingBalance(
  opening: number,
  rows: { debit: number; credit: number }[],
  partyKind: PartyKind,
): number {
  let bal = opening;
  for (const r of rows) {
    if (partyKind === "customer") bal += r.debit - r.credit;
    else if (partyKind === "supplier") bal += r.credit - r.debit;
  }
  return bal;
}

export function assertBalanceMatches(
  stored: number,
  rebuilt: number,
  label: string,
): { ok: boolean; message?: string } {
  if (moneyEquals(stored, rebuilt)) return { ok: true };
  return {
    ok: false,
    message: `${label}: stored=${stored} rebuilt=${rebuilt}`,
  };
}
