-- Phase 4: employee lifecycle + multi-device synchronization hardening.
-- Employee/account state participates in the same durable versioned model used by
-- other synchronized entities. Indexes keep reconciliation and conflict queries
-- bounded as the number of devices and operations grows.

alter table employees
  add column if not exists sync_version bigint not null default 1;

create index if not exists idx_employees_org_sync
  on employees (organization_id, sync_version, updated_at, id);

create index if not exists idx_employee_users_user_active
  on employee_users (user_id, is_active, updated_at);

create index if not exists idx_processed_operations_org_document
  on processed_operations (org_id, document_id, processed_at desc);

create index if not exists idx_sync_outbox_org_status
  on sync_outbox (org_id, status, created_at, device_id);

create index if not exists idx_sync_conflicts_org_status
  on sync_conflicts (organization_id, status, created_at desc, entity_type, entity_id);

create or replace function bump_employee_sync_version()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.sync_version = coalesce(old.sync_version, 0) + 1;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_sync_version on employees;
create trigger trg_employees_sync_version
before update on employees
for each row
execute function bump_employee_sync_version();

-- Existing rows keep their current version; newly created rows start at 1.
update employees
set sync_version = greatest(coalesce(sync_version, 1), 1)
where sync_version is null or sync_version < 1;
