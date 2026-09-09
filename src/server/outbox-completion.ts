import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../lib/db";
import { requirePermission, PERMS } from "./permissions.ts";

/**
 * Finalize an outbox claim only after the business mutation has succeeded.
 * This is intentionally separate from the claim operation so the durable ACK
 * cannot be written before the mutation completes.
 */
export const completeOutboxOperation = createServerFn({ method: "POST" })
  .validator((data: { operationId: string; deviceId: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(PERMS.SYNC_WRITE);
    const operationId = String(data.operationId || "").trim();
    const deviceId = String(data.deviceId || "").trim();
    if (!operationId || !deviceId) {
      return { status: "error", reason: "missing_operation_or_device_id" };
    }

    const sql = await getSql();
    const result = await sql.transaction(async (tx) => {
      const rows = await tx`
        select claim_status
        from processed_operations
        where operation_id = ${operationId}
        limit 1
        for update
      `;

      if (!rows.length) {
        return { status: "missing", operationId };
      }

      const status = String((rows[0] as any).claim_status || "");
      if (status === "applied") {
        return { status: "already_applied", operationId };
      }

      const updated = await tx`
        update processed_operations
        set claim_status = 'applied',
            processed_at = now(),
            result_summary = coalesce(result_summary, '{}'::jsonb) || ${JSON.stringify({ applied: true })}::jsonb
        where operation_id = ${operationId}
          and device_id = ${deviceId}
          and claim_status = 'processing'
        returning operation_id
      `;

      if (updated.length) {
        return { status: "completed", operationId };
      }

      return { status: "in_flight", operationId };
    });

    return result;
  });
