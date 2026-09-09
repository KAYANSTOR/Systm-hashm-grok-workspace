-- Product categories as soft registry (products.category remains free text / id)
create table if not exists product_categories (
    id text primary key,
    name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into product_categories (id, name) values
  ('fabric', 'أقمشة'),
  ('thread', 'خيوط'),
  ('accessory', 'إكسسوارات'),
  ('machine_part', 'قطع آلات')
on conflict (id) do nothing;

-- Ensure default warehouse exists
insert into warehouses (id, name, location) values
  ('wh1', 'المخزن الرئيسي', '')
on conflict (id) do nothing;
