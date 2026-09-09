-- Foundation Phase: make idempotency claims distinguish in-flight work from
-- completed work. Existing rows are historical successful operations.
alter table processed_operations
  add column if not exists claim_status text not null default 'applied'
    check (claim_status in ('processing', 'applied'));

create index if not exists idx_processed_operations_claim
  on processed_operations (claim_status, processed_at);
