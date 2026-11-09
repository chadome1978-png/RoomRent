begin;

create table if not exists public.roomrent_account_data (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.roomrent_account_data enable row level security;

revoke all on table public.roomrent_account_data from anon, authenticated;
grant select on table public.roomrent_account_data to authenticated;

create policy roomrent_account_data_select_own
  on public.roomrent_account_data for select to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.save_roomrent_account_data(
  p_expected_revision bigint,
  p_document jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_new_revision bigint;
  v_rows integer;
begin
  v_owner_id := (select auth.uid());
  if v_owner_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;

  if p_document is null
    or pg_catalog.jsonb_typeof(p_document) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_document -> 'version') is distinct from 'number'
    or p_document -> 'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_document -> 'rooms') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document -> 'invoices') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document -> 'expenses') is distinct from 'array'
    or (p_document ? 'promptPay' and pg_catalog.jsonb_typeof(p_document -> 'promptPay') is distinct from 'object') then
    raise exception 'Invalid account data document' using errcode = '22023';
  end if;

  if pg_catalog.pg_column_size(p_document) > 1048576 then
    raise exception 'Account data document exceeds 1 MiB' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.roomrent_account_data (owner_id, revision, document, updated_at)
    values (v_owner_id, 1, p_document, pg_catalog.now())
    on conflict (owner_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      return 1;
    end if;
  else
    update public.roomrent_account_data
       set revision = revision + 1,
           document = p_document,
           updated_at = pg_catalog.now()
     where owner_id = v_owner_id
       and revision = p_expected_revision
    returning revision into v_new_revision;
    if found then
      return v_new_revision;
    end if;
  end if;

  raise exception 'Account data revision conflict' using errcode = '40001';
end;
$$;

revoke all on function public.save_roomrent_account_data(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_roomrent_account_data(bigint, jsonb) to authenticated;

commit;
