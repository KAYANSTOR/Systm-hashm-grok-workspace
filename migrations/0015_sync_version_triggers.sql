-- Every successful server-side update advances the entity revision.
-- This keeps version metadata correct even for legacy repository functions that
-- use INSERT ... ON CONFLICT DO UPDATE without explicitly setting sync_version.

create or replace function touch_sync_version()
returns trigger
language plpgsql
as $$
begin
  new.sync_version := greatest(coalesce(old.sync_version, 1) + 1, 1);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists parties_touch_sync_version on parties;
create trigger parties_touch_sync_version
before update on parties
for each row execute function touch_sync_version();

drop trigger if exists products_touch_sync_version on products;
create trigger products_touch_sync_version
before update on products
for each row execute function touch_sync_version();

drop trigger if exists invoices_touch_sync_version on invoices;
create trigger invoices_touch_sync_version
before update on invoices
for each row execute function touch_sync_version();

drop trigger if exists vouchers_touch_sync_version on vouchers;
create trigger vouchers_touch_sync_version
before update on vouchers
for each row execute function touch_sync_version();

drop trigger if exists expenses_touch_sync_version on expenses;
create trigger expenses_touch_sync_version
before update on expenses
for each row execute function touch_sync_version();
