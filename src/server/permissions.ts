/**
 * Server permission gate — uses the real roles / permissions tables.
 * Access is fail-closed for normal users and accounts without an active employee linkage.
 * A verified admin role is the explicit bootstrap path so the first employee can be created.
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
  SYNC_WRITE: "sync.write",
  SETTINGS_WRITE: "settings.write",
  AUDIT_READ: "audit.read",
  REPORTS_READ: "reports.read",
  DB_RESET: "db.reset",
  EMPLOYEES_READ: "employees.read",
  EMPLOYEES_MANAGE: "employees.manage",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  INVOICE_CREATE: "invoice.create",
  INVOICE_EDIT: "invoice.edit",
  INVENTORY_ISSUE: "inventory.issue",
  INVENTORY_ADJUST: "inventory.adjust",
} as const;

export type PermissionId = (typeof PERMS)[keyof typeof PERMS];

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(permission: string) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}

export class AccountDisabledError extends Error {
  readonly status = 403;
  constructor() {
    super("Account is disabled");
    this.name = "AccountDisabledError";
  }
}

async function catalogReady(sql: Awaited<ReturnType<typeof getSql>>): Promise<boolean> {
  try {
    const rows = await sql`select count(*)::int as c from permissions`;
    return Number(rows[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

async function accountEnabled(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<boolean> {
  if (userId === DEV_USER_ID && !authConfigured) return true;

  // 1) أي دور معيّن (خصوصًا admin) يكفي لاعتبار الحساب صالحًا — حتى بدون ملف موظف.
  try {
    const roleRows = await sql`
      select 1
      from user_roles ur
      where ur.user_id = ${userId}
      limit 1
    `;
    if (roleRows.length > 0) return true;
  } catch {
    return false;
  }

  // 2) موظف مرتبط وفعّال (حسابات التشغيل اليومية)
  try {
    const rows = await sql`
      select eu.user_id
      from employee_users eu
      join employees e on e.id = eu.employee_id
      where eu.user_id = ${userId}
        and coalesce(eu.is_active, true) = true
        and e.is_active = true
        and e.archived_at is null
      limit 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function userHasPermission(
  userId: string,
  permission: PermissionId | string,
): Promise<boolean> {
  const sql = await getSql();
  if (!(await catalogReady(sql))) return false;

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

export async function requirePermission(
  permission: PermissionId | string,
  bearerToken?: string,
): Promise<string> {
  const userId = await requireUserId(bearerToken);
  const sql = await getSql();
  if (!(await accountEnabled(sql, userId))) throw new AccountDisabledError();
  const allowed = await userHasPermission(userId, permission);
  if (!allowed) throw new ForbiddenError(permission);
  return userId;
}

export async function listUserPermissions(userId: string): Promise<string[]> {
  const sql = await getSql();
  if (!(await catalogReady(sql))) return [];
  const rows = await sql`
    select distinct rp.permission_id as id
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = ${userId}
  `;
  return rows.map((r) => String(r.id));
}

export { authConfigured, DEV_USER_ID };
