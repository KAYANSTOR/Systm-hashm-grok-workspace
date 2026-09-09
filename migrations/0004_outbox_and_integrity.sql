-- Production integrity: outbox, idempotent operations log, audit trail.
-- Safe to re-apply (IF NOT EXISTS / ON CONFLICT patterns).

-- 1) Idempotency registry: same operation_id can never commit twice.
create table if not exists processed_operations (
    operation_id text primary key,
    operation_type text not null,
    document_id text,
    org_id text,
    device_id text,
    result_summary jsonb,
    processed_at timestamptz not null default now()
);

create index if not exists idx_processed_ops_document
  on processed_operations (document_id) where document_id is not null;

-- 2) Server-side outbox mirror (optional; clients also keep local outbox).
create table if not exists sync_outbox (
    id text primary key,
    operation_id text not null unique,
    operation_type text not null,
    document_id text,
    org_id text,
    device_id text,
    payload jsonb not null,
    status text not null default 'pending'
      check (status in ('pending', 'syncing', 'done', 'failed')),
    attempts int not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_sync_outbox_status on sync_outbox (status, created_at);

-- 3) Audit trail (append-only).
create table if not exists audit_events (
    audit_id text primary key,
    org_id text,
    device_id text,
    user_id text,
    operation_id text,
    entity_type text not null,
    entity_id text not null,
    action text not null,
    before_data jsonb,
    after_data jsonb,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_events (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_operation on audit_events (operation_id) where operation_id is not null;

-- 4) Strengthen document uniqueness (already present on some columns; ensure).
-- invoice_number / voucher_number already unique in base schema.

-- 5) Prevent zero-quantity inventory movements as silent noise (opening may be non-zero only).
-- Applied as soft check via app; hard CHECK would break historical rows if any zeros exist.
