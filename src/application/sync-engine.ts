import type { OutboxItem } from "../domain/outbox.ts";
import { mergeOutboxStatus, pendingItems } from "../domain/outbox.ts";

export type ApplyFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;
export type FinalizeFn = (item: OutboxItem) => Promise<{ status: string; operationId?: string; reason?: string }>;
export type ConflictPreflightFn = (item: OutboxItem) => Promise<{ status: string; reason?: string; conflictId?: string; baseVersion?: number; serverVersion?: number }>;

// Keep the pure sync engine importable in Node domain tests. The server
// adapters are only loaded when production synchronization actually needs
// their defaults; callers can inject deterministic adapters in tests.
async function defaultPreflight(item: OutboxItem) {
  const { preflightOutboxConflict } = await import("../server/outbox-conflict.ts");
  return (await preflightOutboxConflict({
    data: {
      operationId: item.operationId,
      operationType: item.operationType,
      documentId: item.documentId,
      orgId: item.orgId,
      deviceId: item.deviceId,
      payload: item.payload,
    },
  })) as any;
}

async function defaultFinalize(item: OutboxItem) {
  const { completeOutboxOperation } = await import("../server/outbox-completion.ts");
  return (await completeOutboxOperation({
    data: { operationId: item.operationId, deviceId: item.deviceId },
  })) as any;
}

async function releaseClaim(item: OutboxItem) {
  const { releaseOutboxClaim } = await import("../server/outbox-recovery.ts");
  await releaseOutboxClaim({
    data: { operationId: item.operationId, deviceId: item.deviceId },
  });
}

export async function drainOutbox(
  items: OutboxItem[],
  apply: ApplyFn,
  opts?: { maxAttempts?: number; finalize?: FinalizeFn; preflight?: ConflictPreflightFn },
): Promise<OutboxItem[]> {
  const { OUTBOX_MAX_ATTEMPTS } = await import("../domain/outbox.ts");
  const maxAttempts = opts?.maxAttempts ?? OUTBOX_MAX_ATTEMPTS;
  const preflight: ConflictPreflightFn = opts?.preflight ?? defaultPreflight;
  const finalize: FinalizeFn = opts?.finalize ?? defaultFinalize;

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
          await releaseClaim(next[i]);
        } catch {
          // The original apply error remains authoritative; claim cleanup is best-effort.
        }
        next[i] = {
          ...next[i],
          status: "failed",
          lastError: res.reason || res.status,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (e: any) {
      try {
        await releaseClaim(next[i]);
      } catch {
        // The original network/apply error remains authoritative.
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
