import { createServerFn } from "@tanstack/react-start";
import { auth } from "../lib/auth/server";
import { getSql } from "../lib/db";
import { requirePermission, PERMS } from "./permissions.ts";

const EMPLOYEE_MANAGE = "employees.manage";
const USER_MANAGE = "users.manage";

export const listEmployees = createServerFn({ method: "GET" })
  .handler(async () => {
    const userId = await requirePermission(PERMS.EMPLOYEES_READ);
    void userId;
    const sql = await getSql();
    return await sql`
      select e.id, e.organization_id, e.name, e.phone, e.job_title, e.department,
             e.is_active, e.archived_at, e.created_at, e.updated_at,
             eu.user_id,
             u.email as user_email,
             coalesce(array_agg(ur.role_id) filter (where ur.role_id is not null), '{}') as roles
      from employees e
      left join employee_users eu on eu.employee_id = e.id
      left join "user" u on u.id = eu.user_id
      left join user_roles ur on ur.user_id = eu.user_id
      where e.organization_id = 'default_org'
      group by e.id, eu.user_id, u.email
      order by e.is_active desc, e.name asc
    `;
  });

export const createEmployee = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(EMPLOYEE_MANAGE);
    const sql = await getSql();
    const id = String(data.id || crypto.randomUUID()).trim();
    const name = String(data.name || "").trim();
    if (!name) throw new Error("اسم الموظف مطلوب");
    const phone = String(data.phone || "").trim() || null;
    const jobTitle = String(data.jobTitle || "").trim() || null;
    const department = String(data.department || "").trim() || null;

    await sql`
      insert into employees (id, organization_id, name, phone, job_title, department)
      values (${id}, 'default_org', ${name}, ${phone}, ${jobTitle}, ${department})
    `;
    return { id };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(EMPLOYEE_MANAGE);
    const id = String(data.id || "").trim();
    if (!id) throw new Error("معرّف الموظف مطلوب");
    const sql = await getSql();
    await sql`
      update employees
      set name=${String(data.name || "").trim()},
          phone=${String(data.phone || "").trim() || null},
          job_title=${String(data.jobTitle || "").trim() || null},
          department=${String(data.department || "").trim() || null}
      where id=${id} and organization_id='default_org'
    `;
    return { id };
  });

export const archiveEmployee = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(EMPLOYEE_MANAGE);
    const id = String(data.id || "").trim();
    if (!id) throw new Error("معرّف الموظف مطلوب");
    const sql = await getSql();
    await sql`
      update employees
      set is_active=false, archived_at=now()
      where id=${id} and organization_id='default_org'
    `;
    return { id };
  });

export const assignEmployeeRole = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string; roleId: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(USER_MANAGE);
    const employeeId = String(data.employeeId || "").trim();
    const roleId = String(data.roleId || "").trim();
    if (!employeeId || !roleId) throw new Error("الموظف والدور مطلوبان");
    const sql = await getSql();
    const rows = await sql`
      select eu.user_id from employee_users eu
      join employees e on e.id=eu.employee_id
      where eu.employee_id=${employeeId} and e.organization_id='default_org'
      limit 1
    `;
    if (!rows.length) throw new Error("لا يوجد حساب دخول مرتبط بالموظف");
    await sql`
      insert into user_roles (user_id, role_id)
      values (${rows[0].user_id}, ${roleId})
      on conflict do nothing
    `;
    return { employeeId, userId: rows[0].user_id, roleId };
  });

export const removeEmployeeRole = createServerFn({ method: "POST" })
  .validator((data: { employeeId: string; roleId: string }) => data)
  .handler(async ({ data }) => {
    await requirePermission(USER_MANAGE);
    const sql = await getSql();
    const rows = await sql`select user_id from employee_users where employee_id=${String(data.employeeId || "").trim()} limit 1`;
    if (!rows.length) throw new Error("لا يوجد حساب دخول مرتبط بالموظف");
    await sql`delete from user_roles where user_id=${rows[0].user_id} and role_id=${String(data.roleId || "").trim()}`;
    return { employeeId: data.employeeId, roleId: data.roleId };
  });

export const createEmployeeAccount = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    await requirePermission(USER_MANAGE);
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

    const result = await auth.api.signUpEmail({
      body: { email, password, name: String(employee[0].name) },
    });
    const userId = String((result as any)?.user?.id || "").trim();
    if (!userId) throw new Error("تعذر إنشاء حساب الدخول");

    await sql`
      insert into employee_users (employee_id, user_id)
      values (${employeeId}, ${userId})
    `;

    const roleId = String(data.roleId || "operator").trim();
    await sql`
      insert into user_roles (user_id, role_id)
      values (${userId}, ${roleId})
      on conflict do nothing
    `;

    return { employeeId, userId, roleId, email };
  });

export const getEmployeeRoles = createServerFn({ method: "GET" })
  .handler(async () => {
    await requirePermission(PERMS.EMPLOYEES_READ);
    const sql = await getSql();
    return await sql`
      select r.id, r.name, r.description,
             count(rp.permission_id)::int as permission_count
      from roles r
      left join role_permissions rp on rp.role_id=r.id
      group by r.id, r.name, r.description
      order by r.id
    `;
  });
