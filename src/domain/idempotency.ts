/**
 * Stable identifiers for ledger and inventory side-effects.
 * Re-running the same business operation with the same document id
 * MUST produce the same row ids → ON CONFLICT / replace is safe.
 */
export function ledgerRowId(documentId: string, role: string): string {
  return `${documentId}__${role}`;
}

export function inventoryMovementId(lineId: string): string {
  return `${lineId}__mov`;
}

export function openingBalanceId(partyId: string): string {
  return `${partyId}__opening`;
}

export function openingStockId(productId: string): string {
  return `${productId}__open`;
}
