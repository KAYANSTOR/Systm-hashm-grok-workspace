import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requirePermission, PERMS } from "./permissions.ts";

function versionFromPayload(payload: any): number | null {
  const value = payload?.syncVersion ?? payload?.sync_version;
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function entityFor(operationType: string): { table: "parties" | "products" | "invoices" | "vouchers" | "expenses"; type: string } | null {
  if (operationType.startsWith("party.") || operationType === "opening.balance") return { table: "parties", type: "party" };
  if (operationType.startsWith("product.") || operationType === "opening.stock") return { table: "products", type: "product" };
  if (operationType.startsWith("invoice.")) return { table: "invoices", type: "invoice" };
  if (operationType.startsWith("voucher.")) return { table: "vouchers", type: "voucher" };
  if (operationType.startsWith("expense.")) return { table: "expenses", type: "expense" };
  return null;
}

export const preflightOutboxConflict = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const userId = await requirePermission(PERMS.SYNC_WRITE);
    const operationId = String(data.operationId || "").trim();
    const operationType = String(data.operationType || "").trim();
    const documentId = String(data.documentId || "").trim();
    const orgId = String(data.orgId || "default_org").trim() || "default_org";
    const payload = data.payload ?? {};
    const baseVersion = versionFromPayload(payload);

    if (!operationId || !operationType || !documentId || baseVersion === null) {
      return { status: "ok", reason: "no_version_precondition" };
    }

    const sql = await getSql();

    // Idempotent retry must reach the normal duplicate/ACK path even when its
    // original base version is now older than the server revision.
    const processed = await sql`
      select claim_status
      from processed_operations
      where operation_id = ${operationId}
      limit 1
    `;
    if (processed.length) {
      return {
        status: "ok",
        reason: String((processed[0] as any).claim_status || "processed_operation"),
      };
    }

    const entity = entityFor(operationType);
    if (!entity) return { status: "ok", reason: "unsupported_entity" };

    let rows: any[] = [];
    if (entity.table === "parties") rows = await sql`select * from parties where id = ${documentId} limit 1` as any[];
    if (entity.table === "products") rows = await sql`select * from products where id = ${documentId} limit 1` as any[];
    if (entity.table === "invoices") rows = await sql`select * from invoices where id = ${documentId} limit 1` as any[];
    if (entity.table === "vouchers") rows = await sql`select * from vouchers where id = ${documentId} limit 1` as any[];
    if (entity.table === "expenses") rows = await sql`select * from expenses where id = ${documentId} limit 1` as any[];

    if (!rows.length) return { status: "ok", reason: "new_entity" };
    const server = rows[0] as any;
    const serverVersion = Number(server.sync_version || 1);
    if (baseVersion >= serverVersion) return { status: "ok", serverVersion };

    const conflictId = `conflict:${operationId}`;
    await sql`
      insert into sync_conflicts (
        id, organization_id, operation_id, operation_type, document_id,
        entity_type, entity_id, device_id, user_id, base_version,
        server_version, local_data, server_data, status
      ) values (
        ${conflictId}, ${orgId}, ${operationId}, ${operationType}, ${documentId},
        ${entity.type}, ${documentId}, ${String(data.deviceId || "") || null}, ${userId},
        ${baseVersion}, ${serverVersion}, ${JSON.stringify(payload)}::jsonb,
        ${JSON.stringify(server)}::jsonb, 'open'
      )
      on conflict (operation_id) do nothing
    `;

    return {
      status: "conflict",
      reason: "stale_version",
      conflictId,
      baseVersion,
      serverVersion,
    };
  });
