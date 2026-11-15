-- RoomRent P0 hardening: authenticated owner-scoped account storage.
-- Run this migration in Supabase SQL Editor before deploying the matching frontend.
-- It does not delete or migrate existing data.

begin;

-- The legacy shared document is no longer an application data source.
-- Keep the table for rollback/audit, but make it inaccessible to browser roles.
alter table if exists public.roomrent_shared_data enable row level security;
revoke all on table public.roomrent_shared_data from public, anon, authenticated;
drop policy if exists roomrent_shared_data_public_read on public.roomrent_shared_data;
revoke all on function public.save_roomrent_shared_data(bigint, jsonb) from public, anon, authenticated;

-- Account snapshots are private to the authenticated owner.
alter table public.roomrent_account_data enable row level security;
revoke all on table public.roomrent_account_data from public, anon, authenticated;
grant select on table public.roomrent_account_data to authenticated;
drop policy if exists roomrent_account_data_select_own on public.roomrent_account_data;
create policy roomrent_account_data_select_own
  on public.roomrent_account_data
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- All writes go through the authenticated, revision-checked RPC.
revoke all on function public.save_roomrent_account_data(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_roomrent_account_data(bigint, jsonb) to authenticated;

commit;

-- Verification queries (run separately if desired):
-- select relrowsecurity from pg_class where oid = 'public.roomrent_account_data'::regclass;
-- select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='roomrent_account_data';
-- select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name in ('save_roomrent_shared_data','save_roomrent_account_data');
