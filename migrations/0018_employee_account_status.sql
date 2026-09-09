-- Phase 3: account lifecycle state stays separate from Better Auth identity.
alter table employee_users
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_employee_users_active
  on employee_users (user_id, is_active);

update employee_users eu
set is_active = e.is_active,
    updated_at = now()
from employees e
where e.id = eu.employee_id;
