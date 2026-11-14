-- Run only after the owner has explicitly approved the shared document state:
-- either a selected snapshot was copied and its counts reviewed, OR a zero-count
-- preflight was reviewed and the owner chose to start with an empty dataset.
-- The current approved production path is the empty-dataset choice.
-- Anyone with the publishable/anon key can read, add, edit, delete, replace,
-- or clear the full shared document through the RPC. Revision checks do not
-- prevent a caller from intentionally overwriting the document.
-- Direct INSERT/UPDATE/DELETE on the table remain revoked.

begin;

revoke all on table public.roomrent_shared_data from public, anon, authenticated;
revoke all on function public.save_roomrent_shared_data(bigint, jsonb) from public, anon, authenticated;

grant select on table public.roomrent_shared_data to anon;
drop policy if exists roomrent_shared_data_public_read on public.roomrent_shared_data;
create policy roomrent_shared_data_public_read
  on public.roomrent_shared_data for select to anon
  using (id = 'shared');

grant execute on function public.save_roomrent_shared_data(bigint, jsonb) to anon;

commit;
