# Warehouse-Scoped Inventory Integrity Report

**Date:** 2026-09-08  
**Status:** PENDING VERIFICATION (not Production Certified)

---

## 1. Executive Summary

Closed the critical gap where Domain stock validation used **global product quantity** instead of **per-warehouse balance**. Inventory effects now update `warehouseStocks` keyed by `(warehouseId, productId)`. Sales and Issue UIs expose an **AppSelect warehouse picker** (preselected default, not hardcoded business logic).

Domain tests: **24 PASS** (including 6 warehouse-scoped cases).

## 2–4. Architecture & Root Cause

| Layer | Before | After |
|---|---|---|
| `canIssue` callers | `item.quantity` (sum) | `canIssueFromWarehouse(warehouseStocks, warehouseId, productId, qty)` |
| `patchInventory` | only `inventory[].quantity` | also `warehouseStocks` rows |
| `applyInvoiceEffects` | no warehouse on stock delta | uses `invoice.warehouseId` |
| UI | default only | AppSelect on Sales + Issue |

**Root cause:** Multi-warehouse routing was added at repository/report level while Domain still treated stock as a single scalar per product.

## 5–8. Domain / Application / Repository

- `stockInWarehouse`, `canIssueFromWarehouse`, `patchWarehouseStockRows`, `rebuildStockByWarehouse`
- `resolveWarehouseId` / `DEFAULT_WAREHOUSE_ID` remain **fallback only**
- `mutateSaveInvoice` stock gate uses warehouse-scoped check
- Repository from prior phase already writes `resolveWarehouseId(inv.warehouseId)` and reverses via `movement.warehouse_id`

## 9–12. Movement · Picker · Default · Disabled

- Invoice carries `warehouseId`; Issue/Purchase paths pass selected id
- Picker lists **active** warehouses only
- Default preselected via `defaultWarehouseId` (`wh1` seed)
- Disabled warehouses excluded from picker (historical movements preserved)

## 13–16. Rebuild · Reverse · Server · Concurrency

- Rebuild helper isolates warehouses (`whA::p1` vs `whB::p1`)
- Reverse uses same `invoice.warehouseId`
- Server validation of live stock under concurrency: **not newly instrumented** (existing SQL transactions); documented as residual risk

## 17–21. Outbox · Sync · Idempotency · Audit · Reports

Unchanged architecture; warehouseId on payload continues through outbox. Reports filter `warehouseStocks` from prior phase.

## 22–24. Performance · Tests

No full inventory reload on picker change. Tests cover A/B isolation, insufficient B, rebuild, reverse.

## 25. Manual Acceptance

1. Stock A=100, B=0 → Issue 50 from B → reject  
2. Issue 30 from A → A=70, B=0  
3. Sales picker Warehouse B → approve with stock only on A → reject  
4. Report filter A vs B matches warehouseStocks

## 26. Regression

Accounting and open-ledger customer payments untouched. Cancel/approve paths still domain-driven.

## 27. Remaining Issues

1. Server-side insufficient-stock check on concurrent devices not explicit beyond TX  
2. Some native `<select>` remain for parties (not warehouse)  
3. typecheck/build/live DB/two-device: NOT RUN

## 28. Certification Blockers

npm ci, typecheck, lint, build, live DB, two-device HA.

## 29. Production Certification Status

**PENDING VERIFICATION**

### Problem → Fix

| Problem | Fix | Files |
|---|---|---|
| Global stock gate | canIssueFromWarehouse | inventory.ts, operations.ts, mutate.ts |
| Effects ignore warehouse | patchInventory + warehouseStocks | operations.ts |
| No picker | AppSelect on sales/issue | sales.tsx, inventory.tsx |