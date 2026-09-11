import { normalizePhone, phoneAccountEmailCandidates } from "./phone.ts";
import type { Sql } from "../db.ts";

export type IdentityResolution =
  | {
      status: "resolved";
      phone: string;
      userId: string;
      userEmail: string;
      accountId: string;
      employeeId: string;
      organizationId: string;
    }
  | {
      status: "not_found" | "credential_missing" | "repair_required" | "inactive";
      phone: string;
      userId?: string;
      employeeId?: string;
      organizationId?: string;
    };

type UserRow = { id: string; email: string };
type AccountRow = { id: string; accountId: string; userId: string };
type EmployeeRow = {
  employeeId: string;
  userId: string;
  organizationId: string;
  employeeActive: boolean;
  linkActive: boolean;
  organizationExists: boolean;
};

/**
 * Resolve the one identity path shared by phone login and emergency recovery.
 * The canonical synthetic email is always tried first; legacy candidates are
 * retained only to read accounts created before migration 0022.
 */
export async function resolveCanonicalAuthIdentity(
  sql: Sql,
  inputPhone: unknown,
): Promise<IdentityResolution> {
  const phone = normalizePhone(inputPhone);
  if (!phone) return { status: "not_found", phone };

  const candidates = phoneAccountEmailCandidates(phone);
  const users = await sql.query<UserRow>(
    `select "id", "email" from "user" where "email" = any($1::text[]) order by array_position($1::text[], "email") limit 1`,
    [candidates],
  );
  const user = users[0];
  if (!user) return { status: "not_found", phone };

  const accounts = await sql.query<AccountRow>(
    `select "id", "accountId", "userId" from "account" where "userId" = $1 and "providerId" = 'credential' limit 1`,
    [user.id],
  );
  const account = accounts[0];
  if (!account) return { status: "credential_missing", phone, userId: user.id };

  const employees = await sql.query<EmployeeRow>(
    `select eu.employee_id as "employeeId",
            eu.user_id as "userId",
            e.organization_id as "organizationId",
            e.is_active as "employeeActive",
            eu.is_active as "linkActive",
            exists (select 1 from organization_profile op where op.id = e.organization_id) as "organizationExists"
       from employee_users eu
       join employees e on e.id = eu.employee_id
      where eu.user_id = $1
      limit 1`,
    [user.id],
  );
  const employee = employees[0];
  if (!employee) return { status: "repair_required", phone, userId: user.id };
  if (!employee.organizationExists) {
    return {
      status: "repair_required",
      phone,
      userId: user.id,
      employeeId: employee.employeeId,
      organizationId: employee.organizationId,
    };
  }
  if (!employee.employeeActive || !employee.linkActive) {
    return {
      status: "inactive",
      phone,
      userId: user.id,
      employeeId: employee.employeeId,
      organizationId: employee.organizationId,
    };
  }

  return {
    status: "resolved",
    phone,
    userId: user.id,
    userEmail: user.email,
    accountId: account.accountId,
    employeeId: employee.employeeId,
    organizationId: employee.organizationId,
  };
}

/** Internal diagnostic classification; safe to use in logs without exposing account details publicly. */
export function recoveryDiagnostic(
  resolution: IdentityResolution,
): "resolved" | "no_identity" | "credential_missing" | "repair_required" | "inactive" {
  if (resolution.status === "resolved") return "resolved";
  if (resolution.status === "not_found") return "no_identity";
  return resolution.status;
}
