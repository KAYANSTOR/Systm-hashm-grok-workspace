-- Foundation Phase: new outbox claims start in-flight and become durable ACKs only after the business mutation completes.
-- Existing rows were historical successful operations and remain applied.
alter table processed_operations
  alter column claim_status set default 'processing';

update processed_operations
set claim_status = 'applied'
where claim_status is null;

comment on column processed_operations.claim_status is
  'processing while the business mutation is in-flight; applied only after successful completion';
