import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requirePermission, PERMS } from "./permissions.ts";

/**
 * Transitional recovery for an in-flight idempotency claim.
 *
 * Only a `processing` claim owned by this device may be released. Completed
 * (`applied`) operations are never deleted by recovery, which prevents a late
 * retry/error path from erasing a durable ACK.
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
          and claim_status = 'processing'
      `;
    });

    return { status: "released", operationId };
  });
