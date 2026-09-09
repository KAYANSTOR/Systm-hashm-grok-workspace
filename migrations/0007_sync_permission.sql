-- Allow authenticated operators to upload their durable local snapshot.
-- This is a permission seed only; it does not change the data model.
insert into permissions (id, name) values
  ('sync.write', 'مزامنة البيانات المحلية')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('admin', 'sync.write'),
  ('operator', 'sync.write')
on conflict do nothing;
