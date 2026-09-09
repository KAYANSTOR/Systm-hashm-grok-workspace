# Warehouse Routing + Server Audit Integration Report

**Date:** 2026-09-08  
**Status:** **PENDING VERIFICATION** (not Production Certified)

---

## 1. Executive Summary

Closed the hardcoding of `warehouse_id = 'wh1'` in repository inventory paths by introducing `resolveWarehouseId(explicit?)` with **DEFAULT_WAREHOUSE_ID only as fallback** for historical/missing values. Wired `warehouse_stock` multi-row fetch, invoice/product `warehouseId` propagation, report filter by warehouse stocks, and **server `audit_events` → client Activity Log merge by `operation_id`**.

Domain tests: **19 PASS**.

## 2–3. Current State & Findings

| Finding | Root cause |
|---|---|
| All movements wrote `wh1` | Literal SQL strings in repository |
| Report warehouse filter ineffective | Stock only loaded for wh1 |
| Activity log local-only | `auditLog` from applyBundle; no server fetch |
| `audit_events` table existed | Written on outbox apply / recordAuditEvent; UI unused |

## 4–8. Warehouse Routing & Integrity

**Rule:**

```ts
resolveWarehouseId(explicit?) → explicit.trim() || DEFAULT_WAREHOUSE_ID ("wh1")
```

Applied in:

- syncLegacy stock inserts  
- addProduct opening stock + movement  
- saveInvoice movement insert + stock upsert  
- delete/cancel stock reverse uses **`movement.warehouse_id` from existing rows** (preserves historical warehouse)

**Invoice / Product** carry optional `warehouseId`. Sales saves with `defaultWarehouseId`. Opening product can pass `warehouseId` from inventory UI.

**Preservation:** Creating warehouse B does not move stock from A; stocks remain keyed by `(warehouse_id, product_id)`.

**Reports:** Stock tab filters `warehouseStocks` by selected warehouse; «كل المخازن» sums quantities.

## 9–12. Audit Integration

| Layer | Behavior |
|---|---|
| Server | `listAuditEvents` reads last 200 from `audit_events` |
| fetchAllData | also returns `auditEvents` + all `warehouse_stock` + `warehouses` |
| Client | `refreshAuditFromServer` merges into `auditLog` keyed by `operation_id` then `audit_id` |
| Dedup | Same `operation_id` → one row (server preferred) |
| UI | Reports → العمليات; details modal shows real fields only |

Local offline entries remain until server ACK brings matching `operation_id`.

## 13–14. Permissions / Design System

No second permission system. AppSelect/AppDatePicker retained from prior phase. Native controls on some forms remain (P2).

## 15–18. Offline / Outbox / Sync / Idempotency

Unchanged paths: mutate → outbox → drain → save* / applyOutboxOperation (writes audit ON CONFLICT DO NOTHING). Warehouse id travels on invoice/product payload.

## 19–21. Accounting / Customer / Reports Regression

- No Payment→Invoice  
- financial_transactions still SoT for money  
- Party ledger report still from transactions  
- Inventory SoT still movements → warehouse_stock  

## 22–23. Database / Migration

No destructive change to 0005. Historical rows with `wh1` remain valid as default warehouse id.

## 24. Performance

Audit limited to 200 server + 500 merged client. Stock filter O(products × stock rows) acceptable for workshop scale.

## 25. Tests

```
operations.test.ts → 19 pass (includes DEFAULT_WAREHOUSE_ID)
```

No live multi-warehouse SQL integration test in this environment.

## 26. Manual Acceptance (required on real stack)

Scenario A: create WH-B → stock only on A → movement with warehouseId B → report filter A vs B.  
Scenario B: customer credit + payment without invoice link.  
Scenario C: approve → refreshAuditFromServer → details operation_id.  
Scenario D: offline mutation → sync → single audit row.

## 27. Remaining Issues

1. Client domain stock check still uses aggregate `item.quantity`, not per-warehouse qty (server stock is correct per warehouse).  
2. Issue/sale UI does not yet expose warehouse picker beyond default (defaultWarehouseId).  
3. Live DB / typecheck / build / two-device HA: **NOT RUN**.  
4. Permissions enforcement still thin.

## 28. Certification Blockers

npm ci, typecheck, lint, build, live migration verify, two-device HA.

## 29. Production Certification Status

**PENDING VERIFICATION**

---

### Problem → Fix log

| Problem | Solution | Files |
|---|---|---|
| Hardcoded wh1 | resolveWarehouseId + movement.warehouse_id on reverse | `repository.ts` |
| Single-warehouse stock fetch | select all warehouse_stock + map warehouseStocks | `repository.ts`, `store.ts` |
| Activity local only | listAuditEvents + merge by operation_id | `repository.ts`, `store.ts`, `reports.tsx` |
| Report filter noop | filter warehouseStocks | `reports.tsx` |
| Invoice without warehouse | warehouseId on type + sales save | `types.ts`, `sales.tsx` |
