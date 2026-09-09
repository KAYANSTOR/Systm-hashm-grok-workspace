-- Permission model completion (idempotent). Does not alter financial/inventory SoT.

create table if not exists user_roles (
    user_id text not null,
    role_id text not null references roles(id),
    primary key (user_id, role_id)
);

insert into roles (id, name, description) values
  ('admin', 'مدير النظام', 'صلاحيات كاملة'),
  ('operator', 'مشغّل', 'عمليات يومية بدون إعدادات حساسة')
on conflict (id) do nothing;

insert into permissions (id, name) values
  ('invoice.write', 'إنشاء وتعديل الفواتير'),
  ('invoice.approve', 'اعتماد الفواتير'),
  ('invoice.cancel', 'إلغاء الفواتير'),
  ('invoice.delete', 'حذف الفواتير'),
  ('voucher.write', 'سندات قبض/صرف'),
  ('expense.write', 'المصروفات'),
  ('party.write', 'عملاء وموردون'),
  ('product.write', 'أصناف المخزون'),
  ('warehouse.write', 'إدارة المخازن'),
  ('category.write', 'التصنيفات'),
  ('settings.write', 'إعدادات المنشأة'),
  ('audit.read', 'سجل العمليات'),
  ('reports.read', 'التقارير'),
  ('db.reset', 'تصفير قاعدة البيانات')
on conflict (id) do nothing;

-- Admin: all
insert into role_permissions (role_id, permission_id)
select 'admin', id from permissions
on conflict do nothing;

-- Operator: day-to-day without settings/db.reset/warehouse structural delete
insert into role_permissions (role_id, permission_id) values
  ('operator', 'invoice.write'),
  ('operator', 'invoice.approve'),
  ('operator', 'invoice.cancel'),
  ('operator', 'voucher.write'),
  ('operator', 'expense.write'),
  ('operator', 'party.write'),
  ('operator', 'product.write'),
  ('operator', 'reports.read'),
  ('operator', 'audit.read')
on conflict do nothing;

-- Dev fallback user gets admin when auth disabled
insert into user_roles (user_id, role_id) values ('dev-user', 'admin')
on conflict do nothing;

create index if not exists idx_user_roles_user on user_roles(user_id);
create index if not exists idx_role_permissions_role on role_permissions(role_id);