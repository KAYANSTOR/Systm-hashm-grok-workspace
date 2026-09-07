create table if not exists organization_profile (
    id text primary key,
    name text not null,
    description text,
    logo text,
    phone text,
    address text,
    email text,
    website text,
    tax_number text,
    commercial_number text,
    footer_text text,
    updated_at timestamptz default now()
);

insert into organization_profile (id, name, address, phone) 
values ('default_org', 'معامل هاشم الأحمدي للتصميم والتطريز', 'صنعاء — شارع الزبيري — مقابل وزارة الدفاع', '770 447 441 - 730 447 441')
on conflict (id) do nothing;
