import type { OutboxItem } from "../domain/outbox.ts";
import { mergeOutboxStatus, pendingItems } from "../domain/outbox.ts";
import { releaseOutboxClaim } from "../server/outbox-recovery";
import { completeOutboxOperation } from "../server/outbox-completion";
import { preflightOutboxConflict } from "../server/outbox-conflict";

export type ApplyFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;
export type FinalizeFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;
export type ConflictPreflightFn = (item: OutboxItem) => Promise<{ status: string; reason?: string; conflictId?: string; baseVersion?: number; serverVersion?: number }>;

export async function drainOutbox(
  items: OutboxItem[],
  apply: ApplyFn,
  opts?: { maxAttempts?: number; finalize?: FinalizeFn; preflight?: ConflictPreflightFn },
): Promise<OutboxItem[]> {
  const maxAttempts = opts?.maxAttempts ?? 8;
  const preflight: ConflictPreflightFn = opts?.preflight ?? (async (item) =>
    (await preflightOutboxConflict({
      data: {
        operationId: item.operationId,
        operationType: item.operationType,
        documentId: item.documentId,
        orgId: item.orgId,
        deviceId: item.deviceId,
        payload: item.payload,
      },
    })) as any
  );
  const finalize: FinalizeFn = opts?.finalize ?? (async (item) =>
    (await completeOutboxOperation({
      data: { operationId: item.operationId, deviceId: item.deviceId },
    })) as any
  );

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
      const gate = await preflight(next[i]);
      if (gate.status === "conflict") {
        next[i] = {
          ...next[i],
          status: "failed",
          lastError: `SYNC_CONFLICT:${gate.conflictId || "unknown"}:base=${gate.baseVersion ?? "?"}:server=${gate.serverVersion ?? "?"}`,
          updatedAt: new Date().toISOString(),
        };
        continue;
      }

      const res = await apply(next[i]);
      if (res.status === "applied" || res.status === "duplicate") {
        const finalized = await finalize(next[i]);
        if (
          finalized.status !== "completed" &&
          finalized.status !== "already_applied" &&
          finalized.status !== "in_flight"
        ) {
          throw new Error(finalized.reason || finalized.status || "outbox_finalize_failed");
        }
        next[i] = {
          ...next[i],
          status: mergeOutboxStatus(next[i].status, "done"),
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        };
      } else {
        try {
          await releaseOutboxClaim({
            data: { operationId: next[i].operationId, deviceId: next[i].deviceId },
          });
        } catch {}
        next[i] = {
          ...next[i],
          status: "failed",
          lastError: res.reason || res.status,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (e: any) {
      try {
        await releaseOutboxClaim({
          data: { operationId: next[i].operationId, deviceId: next[i].deviceId },
        });
      } catch {}
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
