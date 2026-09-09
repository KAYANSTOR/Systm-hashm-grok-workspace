-- Phase 3: employee profile + account linkage + role catalogue.
-- Better Auth remains the sole authentication/credential system.

create table if not exists employees (
  id text primary key,
  organization_id text not null default 'default_org',
  name text not null,
  phone text,
  job_title text,
  department text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_employees_org_phone
  on employees (organization_id, phone)
  where phone is not null and phone <> '';

create index if not exists idx_employees_org_active
  on employees (organization_id, is_active, name);

create table if not exists employee_users (
  employee_id text primary key references employees(id) on delete cascade,
  user_id text not null unique references "user"("id") on delete cascade,
  created_at timestamptz not null default now()
);

insert into roles (id, name, description) values
  ('manager', 'مدير', 'إدارة تشغيلية وصلاحيات إدارية بدون إدارة النظام الكاملة'),
  ('accountant', 'محاسب', 'عمليات مالية وتقارير وحسابات الأطراف'),
  ('storekeeper', 'أمين مخزن', 'عمليات المخزون والمخازن دون إعدادات حساسة'),
  ('viewer', 'مشاهد', 'قراءة التقارير والسجلات المسموح بها')
on conflict (id) do nothing;

insert into permissions (id, name) values
  ('invoice.create', 'إنشاء الفواتير'),
  ('invoice.edit', 'تعديل الفواتير'),
  ('inventory.issue', 'صرف المواد من المخزن'),
  ('inventory.adjust', 'تسوية المخزون'),
  ('employees.read', 'عرض الموظفين'),
  ('employees.manage', 'إدارة الموظفين'),
  ('users.manage', 'إدارة حسابات المستخدمين'),
  ('roles.manage', 'إدارة الأدوار والصلاحيات')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'manager', id from permissions
where id in (
  'invoice.write','invoice.create','invoice.edit','invoice.approve','invoice.cancel',
  'voucher.write','expense.write','party.write','product.write','warehouse.write',
  'category.write','audit.read','reports.read','employees.read','employees.manage','users.manage'
)
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select 'accountant', id from permissions
where id in (
  'invoice.write','invoice.create','invoice.edit','invoice.approve','invoice.cancel',
  'voucher.write','expense.write','party.write','audit.read','reports.read','employees.read'
)
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select 'storekeeper', id from permissions
where id in (
  'invoice.write','product.write','warehouse.write','category.write',
  'inventory.issue','inventory.adjust','audit.read','reports.read','employees.read'
)
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select 'viewer', id from permissions
where id in ('reports.read','audit.read','employees.read')
on conflict do nothing;
