create table if not exists roles (
    id text primary key,
    name text not null,
    description text
);

create table if not exists permissions (
    id text primary key,
    name text not null
);

create table if not exists role_permissions (
    role_id text references roles(id),
    permission_id text references permissions(id),
    primary key (role_id, permission_id)
);

create table if not exists parties (
    id text primary key,
    type text not null check (type in ('customer', 'supplier', 'other')),
    name text not null,
    phone text,
    address text,
    company text,
    tax_number text,
    is_active boolean default true,
    archived_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists warehouses (
    id text primary key,
    name text not null,
    location text,
    is_active boolean default true,
    created_at timestamptz default now()
);

create table if not exists products (
    id text primary key,
    name text not null,
    category text not null,
    unit text not null,
    cost_price decimal(12, 2) not null default 0,
    selling_price decimal(12, 2) not null default 0,
    min_stock decimal(12, 2) not null default 0,
    is_active boolean default true,
    created_at timestamptz default now()
);

create table if not exists warehouse_stock (
    warehouse_id text references warehouses(id),
    product_id text references products(id),
    quantity decimal(12, 2) not null default 0,
    primary key (warehouse_id, product_id)
);

create table if not exists inventory_movements (
    id text primary key,
    product_id text references products(id) not null,
    warehouse_id text references warehouses(id) not null,
    movement_type text not null,
    quantity decimal(12, 2) not null,
    unit_cost decimal(12, 2),
    reference_type text,
    reference_id text,
    created_by text,
    created_at timestamptz default now()
);

create table if not exists accounts (
    id text primary key,
    name text not null,
    type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
    is_active boolean default true,
    created_at timestamptz default now()
);

create table if not exists financial_transactions (
    id text primary key,
    account_id text references accounts(id) not null,
    party_id text references parties(id),
    amount decimal(12, 2) not null,
    debit decimal(12, 2) not null default 0,
    credit decimal(12, 2) not null default 0,
    reference_type text,
    reference_id text,
    description text,
    created_by text,
    created_at timestamptz default now()
);

create table if not exists invoices (
    id text primary key,
    invoice_number text unique not null,
    type text not null check (type in ('sale', 'purchase')),
    invoice_type text,
    party_id text references parties(id) not null,
    date timestamptz not null,
    sub_total decimal(12, 2) not null default 0,
    discount decimal(12, 2) not null default 0,
    total decimal(12, 2) not null default 0,
    paid_amount decimal(12, 2) not null default 0,
    remaining_amount decimal(12, 2) not null default 0,
    payment_type text not null,
    payment_method text,
    status text not null,
    is_approved boolean default false,
    notes text,
    created_by text,
    created_at timestamptz default now()
);

create table if not exists invoice_items (
    id text primary key,
    invoice_id text references invoices(id) not null,
    product_id text references products(id),
    name text not null,
    quantity decimal(12, 2) not null,
    unit text,
    unit_price decimal(12, 2) not null,
    total decimal(12, 2) not null
);

create table if not exists vouchers (
    id text primary key,
    voucher_number text unique not null,
    type text not null check (type in ('receipt', 'payment')),
    party_type text not null,
    party_id text references parties(id),
    amount decimal(12, 2) not null,
    date timestamptz not null,
    payment_method text not null,
    description text,
    created_by text,
    created_at timestamptz default now()
);

create table if not exists expenses (
    id text primary key,
    category text not null,
    amount decimal(12, 2) not null,
    date timestamptz not null,
    payment_method text not null,
    type text not null,
    description text,
    created_by text,
    created_at timestamptz default now()
);

create table if not exists audit_logs (
    id text primary key,
    user_id text,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz default now()
);

-- Default system records
insert into accounts (id, name, type) values 
('cash', 'الصندوق', 'asset'),
('accounts_receivable', 'ذمم مدينة (عملاء)', 'asset'),
('accounts_payable', 'ذمم دائنة (موردين)', 'liability'),
('sales', 'إيرادات المبيعات', 'revenue'),
('purchases', 'مشتريات', 'expense'),
('cogs', 'تكلفة البضاعة المباعة', 'expense')
on conflict (id) do nothing;

insert into warehouses (id, name, location) values
('wh1', 'المخزن الرئيسي', 'المركز')
on conflict (id) do nothing;
