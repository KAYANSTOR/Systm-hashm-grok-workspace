-- Foundation Phase: audit_events is an immutable append-only trail.
-- Business code may INSERT audit records, but must never UPDATE/DELETE history.

create or replace function prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only: % is not allowed', TG_OP
    using errcode = '42501';
end;
$$;

drop trigger if exists audit_events_append_only on audit_events;

create trigger audit_events_append_only
before update or delete on audit_events
for each row
execute function prevent_audit_event_mutation();

comment on table audit_events is
  'Immutable append-only audit trail. UPDATE and DELETE are forbidden.';
