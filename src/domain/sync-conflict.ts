export type SyncConflictStatus = "open" | "resolved" | "dismissed";

export interface SyncConflict {
  id: string;
  organizationId: string;
  operationId: string;
  operationType: string;
  documentId: string;
  entityType: string;
  entityId: string;
  deviceId?: string | null;
  userId?: string | null;
  baseVersion?: number | null;
  serverVersion?: number | null;
  localData?: unknown;
  serverData?: unknown;
  status: SyncConflictStatus;
  resolutionOperationId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export function isStaleWrite(baseVersion: number | null | undefined, serverVersion: number | null | undefined): boolean {
  return baseVersion != null && serverVersion != null && baseVersion < serverVersion;
}
