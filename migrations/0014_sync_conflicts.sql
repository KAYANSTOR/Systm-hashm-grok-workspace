-- Foundation Phase: durable conflict journal.
-- A conflict is data, not a failed network request; keep both sides available
-- so the UI can present an explicit resolution instead of silently overwriting.

create table if not exists sync_conflicts (
  id text primary key,
  organization_id text not null,
  operation_id text not null,
  operation_type text not null,
  document_id text not null,
  entity_type text not null,
  entity_id text not null,
  device_id text,
  user_id text,
  base_version bigint,
  server_version bigint,
  local_data jsonb,
  server_data jsonb,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolution_operation_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create unique index if not exists ux_sync_conflicts_operation
  on sync_conflicts (operation_id);

create index if not exists idx_sync_conflicts_entity
  on sync_conflicts (organization_id, entity_type, entity_id, status);

create index if not exists idx_sync_conflicts_status
  on sync_conflicts (organization_id, status, created_at);
