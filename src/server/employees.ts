import { createServerFn } from "@tanstack/react-start";
import { auth } from "../lib/auth/server";
import { getSql } from "../lib/db";
import { requirePermission, PERMS, userHasPermission } from "./permissions.ts";

const EMPLOYEE_MANAGE = "employees.manage";
const USER_MANAGE = "users.manage";
const ROLE_MANAGE = "roles.manage";
const ADMIN_ROLE = "admin";

async function requireAdmin(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<void> {
  const isAdmin = await userHasPermission(userId, ROLE_MANAGE);
  if (!isAdmin) throw new Error("لا يمكن تنفيذ هذه العملية إلا لمدير النظام");
  const rows = await sql`
    select 1 from user_roles
    where user_id=${userId} and role_id=${ADMIN_ROLE}
    limit 1
  `;
  if (!rows.length) throw new Error("لا يمكن تنفيذ هذه العملية إلا لمدير النظام");
}

export const listEmployees = createServerFn({ method: "GET" })
  .handler(async () => {
    await requirePermission(PERMS.EMPLOYEES_READ);
    const sql = await getSql();
    return (await sql`
      select e.id, e.organization_id, e.name, e.phone, e.job_title, e.department,
             e.is_active, e.archived_at, e.created_at, e.updated_at,
             eu.user_id, coalesce(eu.is_active, true) as account_active,
             u.email as user_email,
             coalesce(array_agg(ur.role_id) filter (where ur.role_id is not null), '{}') as roles
      from employees e
      left join employee_users eu on eu.employee_id = e.id
      left join "user" u on u.id = eu.user_id
      left join user_roles ur on ur.user_id = eu.user_id
      where e.organization_id = 'default_org'
      group by e.id, eu.user_id, eu.is_active, u.email
      order by e.is_active desc, e.name asc
    `) as any[];
  });

export const createEmployee = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(EMPLOYEE_MANAGE);
    const sql = await getSql();
    const id = String(data.id || crypto.randomUUID()).trim();
    const name = String(data.name || "").trim();
    if (!name) throw new Error("اسم الموظف مطلوب");
    await sql`
      insert into employees (id, organization_id, name, phone, job_title, department)
      values (${id}, 'default_org', ${name}, ${String(data.phone || '').trim() || null}, ${String(data.jobTitle || '').trim() || null}, ${String(data.department || '').trim() || null})
    `;
    return { id };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(EMPLOYEE_MANAGE);
    const id = String(data.id || "").trim();
    const name = String(data.name || "").trim();
    if (!id || !name) throw new Error("معرّف واسم الموظف مطلوبان");
    const sql = await getSql();
    const result = await sql`
      update employees
      set name=${name}, phone=${String(data.phone || '').trim() || null}, job_title=${String(data.jobTitle || '').trim() || null}, department=${String(data.department || '').trim() || null}
      where id=${id} and organization_id='default_org'
      returning id
    `;
    if (!result.length) throw new Error("الموظف غير موجود");
    return { id };
  });

export const archiveEmployee = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const actorId = await requirePermission(EMPLOYEE_MANAGE);
    const id = String(data.id || "").trim();
    if (!id) throw new Error("معرّف الموظف مطلوب");
    const sql = await getSql();
    const target = await sql`
      select eu.user_id
      from employees e
      left join employee_users eu on eu.employee_id=e.id
      where e.id=${id} and e.organization_id='default_org'
      limit 1
    `;
    if (!target.length) throw new Error("الموظف غير موجود");
    if (String(target[0].user_id || "") === actorId && target[0].user_id) {
      throw new Error("لا يمكن أرشفة حسابك من شاشة الموظفين");
    }
    await sql.transaction(async (tx) => {
      await tx`update employees set is_active=false, archived_at=now() where id=${id} and organization_id='default_org'`;
      await tx`update employee_users set is_active=false, updated_at=now() where employee_id=${id}`;
    });
    return { id };
  });

export const setEmployeeAccountStatus = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const actorId = await requirePermission(USER_MANAGE);
    const employeeId = String(data.employeeId || "").trim();
    if (!employeeId) throw new Error("معرّف الموظف مطلوب");
    const sql = await getSql();
    const rows = await sql`
      select eu.user_id, exists(select 1 from user_roles ur where ur.user_id=eu.user_id and ur.role_id='admin') as target_is_admin
      from employee_users eu
      join employees e on e.id=eu.employee_id
      where eu.employee_id=${employeeId} and e.organization_id='default_org' limit 1
    `;
    if (!rows.length) throw new Error("لا يوجد حساب دخول مرتبط بالموظف");
    if (String(rows[0].user_id) === actorId) throw new Error("لا يمكنك إيقاف حسابك بنفسك");
    if (rows[0].target_is_admin) await requireAdmin(sql, actorId);
    await sql`update employee_users set is_active=${Boolean(data.isActive)}, updated_at=now() where employee_id=${employeeId}`;
    return { employeeId, isActive: Boolean(data.isActive) };
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string; roleId: string }) => data)
  .handler(async ({ data }) => {
    const actorId = await requirePermission(USER_MANAGE);
    const employeeId = String(data.employeeId || "").trim();
    const roleId = String(data.roleId || "").trim();
    if (!employeeId || !roleId) throw new Error("الموظف والدور مطلوبان");
    const sql = await getSql();
    const rows = await sql`
      select eu.user_id,
             exists(select 1 from user_roles ur where ur.user_id=eu.user_id and ur.role_id='admin') as target_is_admin
      from employee_users eu
      join employees e on e.id=eu.employee_id
      where eu.employee_id=${employeeId} and e.organization_id='default_org' limit 1
    `;
    if (!rows.length) throw new Error("لا يوجد حساب دخول مرتبط بالموظف");
    const roleExists = await sql`select 1 from roles where id=${roleId} limit 1`;
    if (!roleExists.length) throw new Error("الدور غير موجود");
    if (roleId === ADMIN_ROLE || rows[0].target_is_admin) await requireAdmin(sql, actorId);
    if (String(rows[0].user_id) === actorId && roleId !== ADMIN_ROLE) {
      throw new Error("لا يمكنك إزالة دور مدير النظام من حسابك بهذه الطريقة");
    }
    await sql.transaction(async (tx) => {
      await tx`delete from user_roles where user_id=${rows[0].user_id}`;
      await tx`insert into user_roles (user_id, role_id) values (${rows[0].user_id}, ${roleId})`;
    });
    return { employeeId, userId: String(rows[0].user_id), roleId };
  });

export const createEmployeeAccount = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const actorId = await requirePermission(USER_MANAGE);
    const employeeId = String(data.employeeId || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    if (!employeeId || !email || !password) throw new Error("بيانات الحساب غير مكتملة");
    if (password.length < 8) throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف");
    const sql = await getSql();
    const employee = await sql`select id,name,is_active from employees where id=${employeeId} and organization_id='default_org' limit 1`;
    if (!employee.length) throw new Error("الموظف غير موجود");
    if (!employee[0].is_active) throw new Error("لا يمكن إنشاء حساب لموظف مؤرشف");
    const existing = await sql`select employee_id from employee_users where employee_id=${employeeId} limit 1`;
    if (existing.length) throw new Error("الموظف لديه حساب دخول بالفعل");
    const roleId = String(data.roleId || "operator").trim();
    const roleExists = await sql`select 1 from roles where id=${roleId} limit 1`;
    if (!roleExists.length) throw new Error("الدور غير موجود");
    if (roleId === ADMIN_ROLE) await requireAdmin(sql, actorId);
    const result = await auth.api.signUpEmail({ body: { email, password, name: String(employee[0].name) } });
    const userId = String((result as any)?.user?.id || "").trim();
    if (!userId) throw new Error("تعذر إنشاء حساب الدخول");
    await sql.transaction(async (tx) => {
      await tx`insert into employee_users (employee_id,user_id,is_active) values (${employeeId},${userId},true)`;
      await tx`insert into user_roles (user_id,role_id) values (${userId},${roleId}) on conflict do nothing`;
    });
    return { employeeId, userId, roleId, email };
  });

export const getEmployeeRoles = createServerFn({ method: "GET" })
  .handler(async () => {
    await requirePermission(PERMS.EMPLOYEES_READ);
    const sql = await getSql();
    return (await sql`select r.id, r.name, r.description, count(rp.permission_id)::int as permission_count from roles r left join role_permissions rp on rp.role_id=r.id group by r.id,r.name,r.description order by r.id`) as any[];
  });

export const createRole = createServerFn({ method: "POST" })
  .validator((data: { id: string; name: string; description?: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(ROLE_MANAGE);
    const id = String(data.id || "").trim().toLowerCase();
    const name = String(data.name || "").trim();
    if (!/^[a-z0-9._-]+$/.test(id) || !name) throw new Error("معرّف الدور واسم الدور غير صالحين");
    if (id === ADMIN_ROLE) throw new Error("دور مدير النظام محجوز");
    const sql = await getSql();
    await sql`insert into roles (id,name,description) values (${id},${name},${String(data.description || '').trim() || null})`;
    return { id };
  });

export const listPermissions = createServerFn({ method: "GET" })
  .handler(async () => {
    await requirePermission(ROLE_MANAGE);
    const sql = await getSql();
    return (await sql`select id,name from permissions order by id`) as any[];
  });

export const listRolePermissionIds = createServerFn({ method: "GET" })
  .validator((data: { roleId: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(ROLE_MANAGE);
    const roleId = String(data.roleId || "").trim();
    if (!roleId) throw new Error("معرّف الدور مطلوب");
    const sql = await getSql();
    const rows = await sql`select permission_id from role_permissions where role_id=${roleId} order by permission_id`;
    return rows.map((row) => String(row.permission_id));
  });

export const setRolePermissions = createServerFn({ method: "POST" })
  .validator((data: { roleId: string; permissionIds: string[] }) => data)
  .handler(async ({ data }) => {
    const actorId = await requirePermission(ROLE_MANAGE);
    const roleId = String(data.roleId || "").trim();
    const permissionIds = Array.isArray(data.permissionIds) ? [...new Set(data.permissionIds.map(String).filter(Boolean))] : [];
    if (!roleId) throw new Error("معرّف الدور مطلوب");
    if (roleId === ADMIN_ROLE) throw new Error("لا يمكن تعديل صلاحيات مدير النظام الأساسية");
    const sql = await getSql();
    const roleExists = await sql`select 1 from roles where id=${roleId} limit 1`;
    if (!roleExists.length) throw new Error("الدور غير موجود");
    if (permissionIds.length) {
      const invalid = await sql`select count(*)::int as c from permissions where id = any(${permissionIds})`;
      if (Number(invalid[0]?.c || 0) !== permissionIds.length) throw new Error("يوجد صلاحية غير معروفة");
    }
    // Changing a role can be high impact; only the role's administrators may
    // change role definitions. `roles.manage` alone is insufficient for an
    // account carrying the immutable admin role.
    if (roleId === ADMIN_ROLE) await requireAdmin(sql, actorId);
    await sql.transaction(async (tx) => {
      await tx`delete from role_permissions where role_id=${roleId}`;
      if (permissionIds.length) await tx`insert into role_permissions(role_id,permission_id) select ${roleId},p.id from permissions p where p.id=any(${permissionIds}) on conflict do nothing`;
    });
    return { roleId, permissionIds };
  });
