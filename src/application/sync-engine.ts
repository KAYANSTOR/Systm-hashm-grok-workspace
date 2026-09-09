import type { OutboxItem } from "../domain/outbox.ts";
import { mergeOutboxStatus, pendingItems } from "../domain/outbox.ts";
import { releaseOutboxClaim } from "../server/outbox-recovery";
import { applyOutboxOperation } from "../server/repository";

export type ApplyFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;

/**
 * Drain pending outbox items in order.
 *
 * The legacy server path currently claims processed_operations before it runs
 * the business mutation. To close the crash window between that claim and the
 * actual mutation, an "applied" claim is released after the business callback
 * completes and then immediately claimed/finalized again. Therefore a crash
 * before the business mutation leaves no durable processed marker, while the
 * final ACK is still based on the business mutation having completed.
 *
 * Failed items stay for retry with attempts++.
 */
export async function drainOutbox(
  items: OutboxItem[],
  apply: ApplyFn,
  opts?: { maxAttempts?: number },
): Promise<OutboxItem[]> {
  const maxAttempts = opts?.maxAttempts ?? 8;
  const next = items.map((i) => ({ ...i }));
  for (let i = 0; i < next.length; i++) {
    const item = next[i];
    if (item.status === "done") continue;
    if (item.status === "failed" && item.attempts >= maxAttempts) continue;
    if (item.status !== "pending" && item.status !== "failed") continue;

    next[i] = {
      ...item,
      status: "syncing",
      attempts: item.attempts + 1,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await apply(next[i]);

      if (res.status === "applied") {
        // The current applyOutboxOperation records the idempotency marker
        // before the legacy business mutation. The callback above has already
        // completed that mutation, so convert the pre-claim into the durable
        // post-mutation ACK now. Never release a pre-existing duplicate claim.
        try {
          await releaseOutboxClaim({
            data: {
              operationId: next[i].operationId,
              deviceId: next[i].deviceId,
            },
          });
          const finalized = await applyOutboxOperation({ data: next[i] });
          if (finalized.status !== "applied" && finalized.status !== "duplicate") {
            throw new Error(finalized.reason || finalized.status || "outbox_finalize_failed");
          }
        } catch (e: any) {
          // The business mutation already completed. Keep the operation
          // retryable; on retry the server mutation is document-idempotent and
          // the final processed_operations claim will be recreated.
          throw e;
        }

        next[i] = {
          ...next[i],
          status: mergeOutboxStatus(next[i].status, "done"),
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        };
      } else if (res.status === "duplicate") {
        next[i] = {
          ...next[i],
          status: mergeOutboxStatus(next[i].status, "done"),
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        };
      } else {
        try {
          await releaseOutboxClaim({
            data: {
              operationId: next[i].operationId,
              deviceId: next[i].deviceId,
            },
          });
        } catch {
          // Keep the item failed; the next retry can attempt the release again.
        }
        next[i] = {
          ...next[i],
          status: "failed",
          lastError: res.reason || res.status,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (e: any) {
      // If the first apply failed before the business callback completed, the
      // claim is released here. If finalization failed after the business
      // callback, retry is still safe because the business mutations use
      // stable document ids and the final claim is idempotent.
      try {
        await releaseOutboxClaim({
          data: {
            operationId: next[i].operationId,
            deviceId: next[i].deviceId,
          },
        });
      } catch {
        // Preserve the failed item for retry.
      }
      next[i] = {
        ...next[i],
        status: "failed",
        lastError: e?.message || "network",
        updatedAt: new Date().toISOString(),
      };
    }
  }
  return next;
}

export function outboxPendingCount(items: OutboxItem[]): number {
  return pendingItems(items).length;
}