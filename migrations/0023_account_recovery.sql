create table if not exists account_recovery_tokens (
  id text primary key,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

insert into account_recovery_tokens (id, token_hash, expires_at)
values ('emergency-2026-09-11', '886382fb168660dd0aebb70294a0f10c911753dbd7a6ada54cc38524f63fdaa1', now() + interval '2 hours')
on conflict (id) do nothing;
