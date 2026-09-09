/**
 * Local Outbox model — every mutating business operation enqueues one item.
 * Sync engine drains pending items; server enforces operation_id uniqueness.
 */
export type OutboxStatus = "pending" | "syncing" | "done" | "failed";

export type OperationType =
  | "party.upsert"
  | "party.delete"
  | "product.upsert"
  | "product.delete"
  | "invoice.save"
  | "invoice.delete"
  | "invoice.approve"
  | "invoice.cancel"
  | "voucher.save"
  | "voucher.delete"
  | "expense.save"
  | "expense.delete"
  | "opening.balance"
  | "opening.stock";

export interface OutboxItem {
  id: string;
  operationId: string;
  operationType: OperationType;
  documentId?: string;
  orgId: string;
  deviceId: string;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  /** Optional audit snapshot written with the same local commit. */
  audit?: {
    entityType: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
  };
}

export function createOutboxItem(input: {
  operationId: string;
  operationType: OperationType;
  documentId?: string;
  orgId?: string;
  deviceId: string;
  payload: unknown;
  audit?: OutboxItem["audit"];
}): OutboxItem {
  const now = new Date().toISOString();
  return {
    id: input.operationId, // 1:1 with operation for simplicity
    operationId: input.operationId,
    operationType: input.operationType,
    documentId: input.documentId,
    orgId: input.orgId || "default_org",
    deviceId: input.deviceId,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    audit: input.audit,
  };
}

/** Pure merge: newer terminal states win; pending never overwrites done. */
export function mergeOutboxStatus(
  current: OutboxStatus,
  next: OutboxStatus,
): OutboxStatus {
  if (current === "done") return "done";
  if (next === "done") return "done";
  if (next === "failed" && current === "syncing") return "failed";
  return next;
}

export function pendingItems(items: OutboxItem[]): OutboxItem[] {
  return items.filter((i) => i.status === "pending" || i.status === "failed");
}

/**
 * Simulate multi-device merge by operationId.
 * Same operationId → single survivor (prefer done > syncing > pending > failed).
 */
export function mergeOutboxByOperationId(a: OutboxItem[], b: OutboxItem[]): OutboxItem[] {
  const rank: Record<OutboxStatus, number> = {
    done: 3,
    syncing: 2,
    pending: 1,
    failed: 0,
  };
  const map = new Map<string, OutboxItem>();
  for (const item of [...a, ...b]) {
    const prev = map.get(item.operationId);
    if (!prev || rank[item.status] > rank[prev.status]) {
      map.set(item.operationId, item);
    } else if (prev && rank[item.status] === rank[prev.status]) {
      // Same status: keep earlier createdAt (first writer of that state)
      if (item.createdAt < prev.createdAt) map.set(item.operationId, item);
    }
  }
  return [...map.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}
