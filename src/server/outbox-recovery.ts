import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requirePermission, PERMS } from "./permissions.ts";

/**
 * Releases an idempotency claim when the legacy business mutation failed after
 * applyOutboxOperation claimed the operation.
 *
 * This is a transitional recovery path only. The final Foundation design is
 * atomic server-side mutation + idempotency registration + audit in one DB
 * transaction, so a claim should never need to be released after the business
 * mutation starts.
 *
 * The claim is scoped to operation_id + device_id. Audit events are deliberately
 * NOT deleted here because audit_events is an append-only trail; a failed retry
 * must not rewrite audit history.
 */
export const releaseOutboxClaim = createServerFn({ method: "POST" })
  .validator((data: { operationId: string; deviceId: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.SYNC_WRITE);
    const operationId = String(data.operationId || "").trim();
    const deviceId = String(data.deviceId || "").trim();
    if (!operationId || !deviceId) {
      return { status: "error", reason: "missing_operation_or_device_id" };
    }

    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`
        delete from processed_operations
        where operation_id = ${operationId}
          and device_id = ${deviceId}
      `;
    });

    return { status: "released", operationId };
  });
