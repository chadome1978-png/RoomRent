-- RoomRent public cloud mode.
-- This intentionally disables login as a data boundary: the shared dataset is readable
-- by anon/authenticated and writable through the revision-checked public RPC.
-- WARNING: anyone with the app/API URL can read, replace, or clear this shared dataset.

begin;

-- Keep owner-scoped account snapshots private; the public frontend does not use them.
revoke all on table public.roomrent_account_data from public, anon, authenticated;
revoke all on function public.save_roomrent_account_data(bigint, jsonb) from public, anon, authenticated;

-- Public shared dataset: RLS remains enabled, but browser roles receive an explicit read policy.
alter table public.roomrent_shared_data enable row level security;
grant select on table public.roomrent_shared_data to anon, authenticated;
drop policy if exists roomrent_shared_data_public_read on public.roomrent_shared_data;
create policy roomrent_shared_data_public_read
  on public.roomrent_shared_data
  for select
  to anon, authenticated
  using (true);

-- Writes remain inside the validated, revision-checked security-definer RPC.
grant execute on function public.save_roomrent_shared_data(bigint, jsonb) to anon, authenticated;

commit;

-- Verification queries:
-- select relrowsecurity from pg_class where oid = 'public.roomrent_shared_data'::regclass;
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'roomrent_shared_data';
-- select routine_name, grantee, privilege_type from information_schema.routine_privileges
--   where routine_schema = 'public' and routine_name = 'save_roomrent_shared_data';
