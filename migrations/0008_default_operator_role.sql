-- Local phone/password accounts are application operators by default.
-- Administrators can change roles later without changing the authentication model.
insert into user_roles (user_id, role_id)
select u."id", 'operator'
from "user" u
where not exists (
  select 1 from user_roles ur where ur.user_id = u."id"
)
on conflict do nothing;

create or replace function assign_default_operator_role()
returns trigger
language plpgsql
as $$
begin
  insert into user_roles (user_id, role_id)
  values (new."id", 'operator')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists user_default_operator_role on "user";
create trigger user_default_operator_role
after insert on "user"
for each row execute function assign_default_operator_role();
