import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requireUserId } from "../lib/auth/verify.server";

/**
 * Releases an idempotency claim when the legacy business mutation failed after
 * applyOutboxOperation claimed the operation.
 *
 * The claim is scoped to operation_id + device_id. Audit events are deliberately
 * NOT deleted here because audit_events is an append-only trail; a failed retry
 * must not rewrite audit history.
 */
export const releaseOutboxClaim = createServerFn({ method: "POST" })
  .validator((data: { operationId: string; deviceId: string }) => data)
  .handler(async ({ data }) => {
    await requireUserId();
    const operationId = String(data.operationId || "");
    const deviceId = String(data.deviceId || "");
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
