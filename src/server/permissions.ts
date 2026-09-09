/**
 * Server permission gate — uses existing roles / permissions / role_permissions / user_roles.
 * Fail-closed when permission catalog is seeded and user lacks the required permission.
 * Backward-compatible: if catalog empty (pre-migration), allow authenticated callers.
 */
import { getSql } from "../lib/db";
import {
  requireUserId,
  authConfigured,
  DEV_USER_ID,
} from "../lib/auth/verify.server";

export const PERMS = {
  INVOICE_WRITE: "invoice.write",
  INVOICE_APPROVE: "invoice.approve",
  INVOICE_CANCEL: "invoice.cancel",
  INVOICE_DELETE: "invoice.delete",
  VOUCHER_WRITE: "voucher.write",
  EXPENSE_WRITE: "expense.write",
  PARTY_WRITE: "party.write",
  PRODUCT_WRITE: "product.write",
  WAREHOUSE_WRITE: "warehouse.write",
  CATEGORY_WRITE: "category.write",
  SETTINGS_WRITE: "settings.write",
  AUDIT_READ: "audit.read",
  REPORTS_READ: "reports.read",
  DB_RESET: "db.reset",
} as const;

export type PermissionId = (typeof PERMS)[keyof typeof PERMS];

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(permission: string) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** True when roles/permissions tables have been seeded. */
async function catalogReady(sql: Awaited<ReturnType<typeof getSql>>): Promise<boolean> {
  try {
    const rows = await sql`select count(*)::int as c from permissions`;
    return Number(rows[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

export async function userHasPermission(
  userId: string,
  permission: PermissionId | string,
): Promise<boolean> {
  const sql = await getSql();
  if (!(await catalogReady(sql))) return true; // pre-seed compatibility

  const rows = await sql`
    select 1 as ok
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = ${userId}
      and rp.permission_id = ${permission}
    limit 1
  `;
  return rows.length > 0;
}

/**
 * Authenticate + authorize. Call at the top of every sensitive server mutation.
 * Returns the verified userId on success.
 */
export async function requirePermission(
  permission: PermissionId | string,
  bearerToken?: string,
): Promise<string> {
  const userId = await requireUserId(bearerToken);
  // Auth disabled local/dev path already returned DEV_USER_ID; still enforce catalog.
  const allowed = await userHasPermission(userId, permission);
  if (!allowed) throw new ForbiddenError(permission);
  return userId;
}

/** List permission ids for a user (for client projection / offline UX). */
export async function listUserPermissions(userId: string): Promise<string[]> {
  const sql = await getSql();
  if (!(await catalogReady(sql))) {
    return Object.values(PERMS);
  }
  const rows = await sql`
    select distinct rp.permission_id as id
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = ${userId}
  `;
  return rows.map((r: { id: string }) => r.id);
}

export { authConfigured, DEV_USER_ID };
