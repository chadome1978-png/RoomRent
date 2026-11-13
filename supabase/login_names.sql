-- RoomRent username login mapping schema.
-- Stores no passwords. Client roles cannot read or write this table.
-- Run this file in the Supabase SQL Editor before deploying the Edge Function.

begin;

create table if not exists public.login_names (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint login_names_username_format
    check (username ~ '^[a-z0-9_]{3,32}$')
);

alter table public.login_names enable row level security;
revoke all on table public.login_names from public, anon, authenticated;
grant select on table public.login_names to service_role;

commit;
