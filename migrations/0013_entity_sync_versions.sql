-- Foundation Phase: explicit per-entity revision metadata.
-- This migration is additive: existing rows start at revision 1.
-- The sync layer can use this metadata to detect stale writes instead of
-- silently allowing one offline device to overwrite another device's change.

alter table parties
  add column if not exists sync_version bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by text;

alter table products
  add column if not exists sync_version bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by text;

alter table invoices
  add column if not exists sync_version bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by text;

alter table vouchers
  add column if not exists sync_version bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by text;

alter table expenses
  add column if not exists sync_version bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by text;

create index if not exists idx_parties_sync_version on parties (id, sync_version);
create index if not exists idx_products_sync_version on products (id, sync_version);
create index if not exists idx_invoices_sync_version on invoices (id, sync_version);
create index if not exists idx_vouchers_sync_version on vouchers (id, sync_version);
create index if not exists idx_expenses_sync_version on expenses (id, sync_version);
