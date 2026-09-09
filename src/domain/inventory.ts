/** Historical default warehouse seed id — fallback only when document has no warehouseId. */
export const DEFAULT_WAREHOUSE_ID = "wh1";

/**
 * Inventory Source of Truth: inventory_movements (signed quantity).
 * warehouse_stock is a maintained projection keyed by (warehouseId, productId).
 */

export type StockMovement = {
  productId: string;
  quantity: number; // signed: + in, - out
  warehouseId?: string;
  referenceId?: string;
  movementType?: string;
};

/** Composite key for warehouse-scoped stock maps. */
export function stockKey(warehouseId: string, productId: string): string {
  return `${warehouseId}::${productId}`;
}

export function resolveWarehouseId(explicit?: string | null): string {
  const id = (explicit || "").trim();
  return id || DEFAULT_WAREHOUSE_ID;
}

/**
 * Rebuild per-warehouse stock from signed movements.
 * Movements without warehouseId fall back to DEFAULT_WAREHOUSE_ID (historical).
 */
export function rebuildStockByWarehouse(
  movements: StockMovement[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    if (!m.productId) continue;
    const wh = resolveWarehouseId(m.warehouseId);
    const key = stockKey(wh, m.productId);
    map.set(key, (map.get(key) || 0) + Number(m.quantity));
  }
  return map;
}

/** @deprecated global rebuild — prefer rebuildStockByWarehouse for multi-warehouse. */
export function rebuildStock(
  movements: StockMovement[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    if (!m.productId) continue;
    map.set(m.productId, (map.get(m.productId) || 0) + Number(m.quantity));
  }
  return map;
}

export function stockInWarehouse(
  warehouseStocks: Array<{ warehouseId: string; productId: string; quantity: number }> | undefined,
  warehouseId: string | undefined,
  productId: string,
): number {
  const wh = resolveWarehouseId(warehouseId);
  if (!warehouseStocks?.length) return 0;
  return warehouseStocks
    .filter((s) => s.warehouseId === wh && s.productId === productId)
    .reduce((sum, s) => sum + Number(s.quantity || 0), 0);
}

export function canIssue(
  available: number,
  requested: number,
): { ok: true } | { ok: false; available: number; requested: number } {
  if (requested <= 0) return { ok: false, available, requested };
  if (requested > available + 1e-9) return { ok: false, available, requested };
  return { ok: true };
}

/** Warehouse-scoped issue gate. */
export function canIssueFromWarehouse(
  warehouseStocks: Array<{ warehouseId: string; productId: string; quantity: number }> | undefined,
  warehouseId: string | undefined,
  productId: string,
  requested: number,
): { ok: true; available: number } | { ok: false; available: number; requested: number } {
  const available = stockInWarehouse(warehouseStocks, warehouseId, productId);
  const check = canIssue(available, requested);
  if (!check.ok) return { ok: false, available, requested };
  return { ok: true, available };
}

export function projectedAfter(current: number, delta: number): number {
  return current + delta;
}

/** Apply signed qty change to warehouseStocks rows. */
export function patchWarehouseStockRows(
  rows: Array<{ warehouseId: string; productId: string; quantity: number }>,
  warehouseId: string,
  productId: string,
  qtyDelta: number,
): Array<{ warehouseId: string; productId: string; quantity: number }> {
  if (!productId || qtyDelta === 0) return rows;
  const wh = resolveWarehouseId(warehouseId);
  let found = false;
  const next = rows.map((r) => {
    if (r.warehouseId === wh && r.productId === productId) {
      found = true;
      return { ...r, quantity: r.quantity + qtyDelta };
    }
    return r;
  });
  if (!found && qtyDelta !== 0) {
    next.push({ warehouseId: wh, productId, quantity: qtyDelta });
  }
  return next;
}
