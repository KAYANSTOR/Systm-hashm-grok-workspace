import type { OutboxItem } from "../domain/outbox.ts";
import { mergeOutboxStatus, pendingItems } from "../domain/outbox.ts";
import { releaseOutboxClaim } from "../server/outbox-recovery";

export type ApplyFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;

/**
 * Drain pending outbox items in order. Marks done on success / duplicate.
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
      if (res.status === "applied" || res.status === "duplicate") {
        next[i] = {
          ...next[i],
          status: mergeOutboxStatus(next[i].status, "done"),
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // applyOutboxOperation claims idempotency before the legacy server
        // mutation runs. If the mutation reports a non-success result, release
        // that claim so the operation can be retried safely.
        try {
          await releaseOutboxClaim({ data: { operationId: next[i].operationId, deviceId: next[i].deviceId } });
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
      // A transport/server error can happen after the idempotency row was
      // claimed but before the business mutation completed. Remove only our
      // own claim; if the mutation actually committed, the processed row stays
      // intact and the next retry will receive a duplicate ACK.
      try {
        await releaseOutboxClaim({ data: { operationId: next[i].operationId, deviceId: next[i].deviceId } });
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
