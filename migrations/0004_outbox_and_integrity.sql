-- 0004_outbox_and_integrity.sql
-- Outbox / idempotency / audit integrity layer

create table if not exists processed_operations (
  operation_id text primary key,
  operation_type text not null,
  document_id text,
  org_id text not null default 'default_org',
  device_id text,
  result_summary jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  audit_id text primary key,
  org_id text not null default 'default_org',
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

create unique index if not exists audit_events_operation_id_uq
  on audit_events(operation_id) where operation_id is not null;

create index if not exists audit_events_created_at_idx on audit_events(created_at desc);
create index if not exists audit_events_entity_idx on audit_events(entity_type, entity_id);
create index if not exists processed_operations_document_idx on processed_operations(document_id);
