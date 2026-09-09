import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requireUserId } from "../lib/auth/verify.server";

/**
 * Releases an idempotency claim when the business mutation failed after
 * applyOutboxOperation claimed the operation. This is deliberately scoped to
 * operation_id + device_id so a failed retry cannot remove another device's
 * successful claim.
 */
export const releaseOutboxClaim = createServerFn({ method: "POST" })
  .validator((data: { operationId: string; deviceId?: string }) => data)
  .handler(async ({ data }) => {
    await requireUserId();
    const operationId = String(data.operationId || "");
    const deviceId = String(data.deviceId || "");
    if (!operationId) return { status: "error", reason: "missing_operation_id" };

    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`
        delete from audit_events
        where operation_id = ${operationId}
          and (${deviceId} = '' or device_id = ${deviceId})
      `;
      await tx`
        delete from processed_operations
        where operation_id = ${operationId}
          and (${deviceId} = '' or device_id = ${deviceId})
      `;
    });

    return { status: "released", operationId };
  });
