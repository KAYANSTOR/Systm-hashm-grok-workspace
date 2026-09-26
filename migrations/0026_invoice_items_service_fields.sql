-- حقول خدمة التطريز المنظمة على بنود الفاتورة
-- متوافقة مع البنود القديمة: quantity/unit/unit_price تبقى المصدر الاحتياطي

alter table public.invoice_items
  add column if not exists description text;

alter table public.invoice_items
  add column if not exists service_unit text;

alter table public.invoice_items
  add column if not exists service_quantity decimal(12, 2);

alter table public.invoice_items
  add column if not exists service_unit_price decimal(12, 2);

-- قيّد القيم المسموحة لوحدة الخدمة (NULL للبنود غير الخدمية)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_items_service_unit_check'
  ) then
    alter table public.invoice_items
      add constraint invoice_items_service_unit_check
      check (service_unit is null or service_unit in ('taqa', 'war', 'brush'));
  end if;
end $$;
