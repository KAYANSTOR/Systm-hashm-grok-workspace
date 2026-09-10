-- Canonicalize legacy employee phone values and Better Auth synthetic emails.
-- This is deliberately idempotent so it is safe on every supported database.
with normalized as (
  select
    eu.user_id,
    case
      when regexp_replace(e.phone, '[^0-9]', '', 'g') like '00967%'
        then substring(regexp_replace(e.phone, '[^0-9]', '', 'g') from 6)
      when regexp_replace(e.phone, '[^0-9]', '', 'g') like '967%'
        then substring(regexp_replace(e.phone, '[^0-9]', '', 'g') from 4)
      when regexp_replace(e.phone, '[^0-9]', '', 'g') like '0%' and length(regexp_replace(e.phone, '[^0-9]', '', 'g')) = 10
        then substring(regexp_replace(e.phone, '[^0-9]', '', 'g') from 2)
      else regexp_replace(e.phone, '[^0-9]', '', 'g')
    end as phone
  from employee_users eu
  join employees e on e.id = eu.employee_id
  where e.phone is not null and e.phone <> ''
), updates as (
  update employees e
  set phone = n.phone, updated_at = now()
  from employee_users eu
  join normalized n on n.user_id = eu.user_id
  where eu.employee_id = e.id and e.phone is distinct from n.phone
  returning n.user_id, n.phone
)
update "user" u
set email = 'phone-' || n.phone || '@accounts.hashem.local', "updatedAt" = now()
from normalized n
where u.id = n.user_id
  and u.email <> 'phone-' || n.phone || '@accounts.hashem.local'
  and not exists (
    select 1 from "user" conflict
    where conflict.email = 'phone-' || n.phone || '@accounts.hashem.local'
      and conflict.id <> u.id
  );

update "account" a
set "accountId" = u.email, "updatedAt" = now()
from "user" u
where a."userId" = u.id
  and a."providerId" = 'credential'
  and a."accountId" <> u.email;
