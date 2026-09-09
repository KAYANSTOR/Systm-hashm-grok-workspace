import type { OutboxItem } from "../domain/outbox.ts";
import { mergeOutboxStatus, pendingItems } from "../domain/outbox.ts";

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
        next[i] = {
          ...next[i],
          status: "failed",
          lastError: res.reason || res.status,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (e: any) {
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
