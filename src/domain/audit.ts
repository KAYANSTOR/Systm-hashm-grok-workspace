import type { OperationType } from "./outbox.ts";

export interface AuditEvent {
  auditId: string;
  orgId: string;
  deviceId: string;
  userId?: string;
  operationId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function buildAuditEvent(input: {
  operationId: string;
  deviceId: string;
  orgId?: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}): AuditEvent {
  return {
    auditId: `${input.operationId}__audit`,
    orgId: input.orgId || "default_org",
    deviceId: input.deviceId,
    userId: input.userId,
    operationId: input.operationId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
}

export function actionForOperation(type: OperationType): string {
  const map: Record<OperationType, string> = {
    "party.upsert": "upsert",
    "party.delete": "delete",
    "product.upsert": "upsert",
    "product.delete": "delete",
    "invoice.save": "save",
    "invoice.delete": "delete",
    "invoice.approve": "approve",
    "invoice.cancel": "cancel",
    "voucher.save": "save",
    "voucher.delete": "delete",
    "expense.save": "save",
    "expense.delete": "delete",
    "opening.balance": "opening_balance",
    "opening.stock": "opening_stock",
  };
  return map[type] || type;
}
