/**
 * Explicit document lifecycle. Transitions outside this map are rejected.
 */
export type DocLifecycleState = "draft" | "approved" | "cancelled";

const ALLOWED: Record<DocLifecycleState, DocLifecycleState[]> = {
  draft: ["approved", "cancelled"],
  approved: ["cancelled"],
  cancelled: [],
};

export function canTransition(
  from: DocLifecycleState,
  to: DocLifecycleState,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function invoiceLifecycle(isApproved: boolean, cancelledOrDeleted = false): DocLifecycleState {
  if (cancelledOrDeleted) return "cancelled";
  return isApproved ? "approved" : "draft";
}

export function assertTransition(
  from: DocLifecycleState,
  to: DocLifecycleState,
): { ok: true } | { ok: false; message: string } {
  if (canTransition(from, to)) return { ok: true };
  return {
    ok: false,
    message: `الانتقال غير مسموح: ${from} → ${to}`,
  };
}
