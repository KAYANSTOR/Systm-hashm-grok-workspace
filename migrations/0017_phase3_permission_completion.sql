-- Phase 3: make the seeded admin role inherit every current permission,
-- including permissions introduced by later migrations.
insert into role_permissions (role_id, permission_id)
select 'admin', p.id
from permissions p
on conflict do nothing;

-- Operators may see the employee directory but cannot administer accounts.
insert into role_permissions (role_id, permission_id)
values ('operator', 'employees.read')
on conflict do nothing;
