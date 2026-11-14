-- RoomRent shared public mode: private staging schema.
-- This file intentionally does NOT grant anon read/write access.
-- After backup, preflight, and copying the selected snapshot, run
-- roomrent_shared_data_enable_public.sql as a separate final step.
-- This migration does not alter or delete existing owner-scoped snapshots.

begin;

create table if not exists public.roomrent_shared_data (
  id text primary key check (id = 'shared'),
  revision bigint not null check (revision >= 1),
  document jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.roomrent_shared_data enable row level security;

revoke all on table public.roomrent_shared_data from public, anon, authenticated;
drop policy if exists roomrent_shared_data_public_read on public.roomrent_shared_data;

insert into public.roomrent_shared_data (id, revision, document)
values (
  'shared',
  1,
  '{"version":1,"rooms":[],"invoices":[],"expenses":[]}'::jsonb
)
on conflict (id) do nothing;

create or replace function public.roomrent_shared_document_is_valid(p_document jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_extra jsonb;
  v_date date;
  v_promptpay_id text;
  v_recipient_name text;
begin
  if p_document is null
    or pg_catalog.jsonb_typeof(p_document) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_document -> 'version') is distinct from 'number'
    or p_document -> 'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_document -> 'rooms') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document -> 'invoices') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document -> 'expenses') is distinct from 'array'
    or (p_document ? 'legacyRoomsImported' and pg_catalog.jsonb_typeof(p_document -> 'legacyRoomsImported') is distinct from 'boolean')
    or pg_catalog.pg_column_size(p_document) > 1048576 then
    return false;
  end if;

  if p_document ? 'promptPay' then
    if pg_catalog.jsonb_typeof(p_document -> 'promptPay') is distinct from 'object' then return false; end if;
    if pg_catalog.jsonb_typeof(p_document -> 'promptPay' -> 'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(p_document -> 'promptPay' -> 'recipientName') is distinct from 'string' then
      return false;
    end if;
    v_promptpay_id := p_document -> 'promptPay' ->> 'id';
    v_recipient_name := p_document -> 'promptPay' ->> 'recipientName';
    if v_promptpay_id is null
      or v_promptpay_id !~ '^(0[0-9]{9}|[0-9]{13}|[0-9]{15})$'
      or v_recipient_name is null
      or pg_catalog.length(pg_catalog.btrim(v_recipient_name)) = 0
      or pg_catalog.length(v_recipient_name) > 80 then
      return false;
    end if;
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_document -> 'rooms') as items(value) loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_item -> 'id') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'roomNumber') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'tenantName') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'phone') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'rentAmount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterRate') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricRate') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'status') is distinct from 'string'
      or v_item ->> 'status' not in ('occupied', 'vacant', 'archived')
      or pg_catalog.jsonb_typeof(v_item -> 'createdAt') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'updatedAt') is distinct from 'string' then
      return false;
    end if;
    if (v_item ->> 'rentAmount')::numeric < 0
      or (v_item ->> 'waterRate')::numeric < 0
      or (v_item ->> 'electricRate')::numeric < 0 then
      return false;
    end if;
  end loop;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_document -> 'invoices') as items(value) loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_item -> 'id') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'roomId') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'roomNumber') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'tenantName') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'phone') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'period') is distinct from 'string'
      or (v_item ->> 'period') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      or pg_catalog.jsonb_typeof(v_item -> 'dueDate') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'rentAmount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterPrevious') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterCurrent') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterUnits') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterRate') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'waterAmount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricPrevious') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricCurrent') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricUnits') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricRate') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'electricAmount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'extras') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_item -> 'totalAmount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'note') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'status') is distinct from 'string'
      or v_item ->> 'status' not in ('paid', 'unpaid')
      or pg_catalog.jsonb_typeof(v_item -> 'issuedAt') is distinct from 'string' then
      return false;
    end if;

    for v_extra in select value from pg_catalog.jsonb_array_elements(v_item -> 'extras') as extras(value) loop
      if pg_catalog.jsonb_typeof(v_extra) is distinct from 'object'
        or pg_catalog.jsonb_typeof(v_extra -> 'label') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_extra -> 'amount') is distinct from 'number' then
        return false;
      end if;
    end loop;
  end loop;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_document -> 'expenses') as items(value) loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_item -> 'id') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'date') is distinct from 'string'
      or (v_item ->> 'date') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      or pg_catalog.jsonb_typeof(v_item -> 'category') is distinct from 'string'
      or v_item ->> 'category' not in ('maintenance', 'utilities', 'cleaning', 'staff', 'supplies', 'tax', 'other')
      or pg_catalog.jsonb_typeof(v_item -> 'description') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(v_item ->> 'description')) = 0
      or pg_catalog.jsonb_typeof(v_item -> 'amount') is distinct from 'number'
      or pg_catalog.jsonb_typeof(v_item -> 'note') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'createdAt') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'updatedAt') is distinct from 'string' then
      return false;
    end if;
    if (v_item ->> 'amount')::numeric <= 0 then return false; end if;
    begin
      v_date := (v_item ->> 'date')::date;
    exception when others then
      return false;
    end;
    if pg_catalog.to_char(v_date, 'YYYY-MM-DD') is distinct from v_item ->> 'date' then return false; end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.roomrent_shared_document_is_valid(jsonb) from public, anon, authenticated;

create or replace function public.save_roomrent_shared_data(
  p_expected_revision bigint,
  p_document jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_revision bigint;
  v_rows integer;
begin
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;

  if not public.roomrent_shared_document_is_valid(p_document) then
    raise exception 'Invalid shared data document' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.roomrent_shared_data (id, revision, document, updated_at)
    values ('shared', 1, p_document, pg_catalog.now())
    on conflict (id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then return 1; end if;
  else
    update public.roomrent_shared_data
       set revision = revision + 1,
           document = p_document,
           updated_at = pg_catalog.now()
     where id = 'shared'
       and revision = p_expected_revision
    returning revision into v_new_revision;
    if found then return v_new_revision; end if;
  end if;

  raise exception 'Shared data revision conflict' using errcode = '40001';
end;
$$;

revoke all on function public.save_roomrent_shared_data(bigint, jsonb) from public, anon, authenticated;

-- Privileged preflight for the owner to confirm a source snapshot without returning PII.
create or replace function public.preview_roomrent_account_snapshot(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_document jsonb;
begin
  if p_owner_id is null then
    raise exception 'An explicit source owner id is required' using errcode = '22023';
  end if;

  select revision, document
    into v_revision, v_document
    from public.roomrent_account_data
   where owner_id = p_owner_id;
  if not found then
    raise exception 'Source account snapshot not found' using errcode = 'P0002';
  end if;
  if not public.roomrent_shared_document_is_valid(v_document) then
    raise exception 'Source account document is invalid or exceeds 1 MiB' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'ownerId', p_owner_id,
    'revision', v_revision,
    'rooms', pg_catalog.jsonb_array_length(v_document -> 'rooms'),
    'invoices', pg_catalog.jsonb_array_length(v_document -> 'invoices'),
    'expenses', pg_catalog.jsonb_array_length(v_document -> 'expenses'),
    'promptPayConfigured', v_document ? 'promptPay'
  );
end;
$$;

revoke all on function public.preview_roomrent_account_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.preview_roomrent_account_snapshot(uuid) to service_role;

-- Administrative, one-time copy only. Run from Supabase SQL Editor after backup and consent.
-- The function returns counts only and leaves the private source snapshot untouched.
create or replace function public.copy_roomrent_account_snapshot_to_shared(
  p_owner_id uuid,
  p_expected_source_revision bigint,
  p_expected_shared_revision bigint,
  p_backup_confirmed boolean,
  p_public_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_revision bigint;
  v_source_document jsonb;
  v_shared_revision bigint;
  v_shared_document jsonb;
  v_new_revision bigint;
begin
  if p_owner_id is null
    or p_expected_source_revision is null
    or p_expected_source_revision < 1
    or p_expected_shared_revision is null
    or p_expected_shared_revision < 1
    or p_backup_confirmed is distinct from true
    or p_public_consent is distinct from true then
    raise exception 'Explicit source, revision, backup, and public consent are required' using errcode = '22023';
  end if;

  select revision, document
    into v_source_revision, v_source_document
    from public.roomrent_account_data
   where owner_id = p_owner_id
   for share;
  if not found then
    raise exception 'Source account snapshot not found' using errcode = 'P0002';
  end if;
  if v_source_revision <> p_expected_source_revision then
    raise exception 'Source snapshot revision changed' using errcode = '40001';
  end if;

  if not public.roomrent_shared_document_is_valid(v_source_document) then
    raise exception 'Source account document is invalid or exceeds 1 MiB' using errcode = '22023';
  end if;

  select revision, document
    into v_shared_revision, v_shared_document
    from public.roomrent_shared_data
   where id = 'shared'
   for update;
  if not found then
    raise exception 'Shared dataset row not found' using errcode = 'P0002';
  end if;
  if v_shared_revision <> p_expected_shared_revision then
    raise exception 'Shared dataset revision changed' using errcode = '40001';
  end if;
  if pg_catalog.jsonb_array_length(v_shared_document -> 'rooms') > 0
    or pg_catalog.jsonb_array_length(v_shared_document -> 'invoices') > 0
    or pg_catalog.jsonb_array_length(v_shared_document -> 'expenses') > 0
    or v_shared_document ? 'promptPay' then
    raise exception 'Shared dataset is not empty; refusing to overwrite' using errcode = '23505';
  end if;

  update public.roomrent_shared_data
     set revision = revision + 1,
         document = v_source_document,
         updated_at = pg_catalog.now()
   where id = 'shared'
     and revision = p_expected_shared_revision
  returning revision into v_new_revision;
  if not found then
    raise exception 'Shared dataset revision changed' using errcode = '40001';
  end if;

  return pg_catalog.jsonb_build_object(
    'revision', v_new_revision,
    'rooms', pg_catalog.jsonb_array_length(v_source_document -> 'rooms'),
    'invoices', pg_catalog.jsonb_array_length(v_source_document -> 'invoices'),
    'expenses', pg_catalog.jsonb_array_length(v_source_document -> 'expenses'),
    'promptPayConfigured', v_source_document ? 'promptPay'
  );
end;
$$;

revoke all on function public.copy_roomrent_account_snapshot_to_shared(uuid, bigint, bigint, boolean, boolean) from public, anon, authenticated;
grant execute on function public.copy_roomrent_account_snapshot_to_shared(uuid, bigint, bigint, boolean, boolean) to service_role;

commit;
