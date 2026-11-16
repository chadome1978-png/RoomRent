-- RoomRent partial-payment compatibility migration.
-- Apply this file in the Supabase SQL Editor after reviewing the current shared row.
-- It only replaces the document validator and its grants; it does not read, rewrite,
-- delete, or migrate any room, invoice, tenant, or payment data.

begin;

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
  v_total numeric;
  v_paid numeric;
  v_balance numeric;
  v_has_paid boolean;
  v_has_balance boolean;
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
      or v_item ->> 'status' not in ('paid', 'unpaid', 'partial')
      or pg_catalog.jsonb_typeof(v_item -> 'issuedAt') is distinct from 'string' then
      return false;
    end if;

    v_total := (v_item ->> 'totalAmount')::numeric;
    if v_total < 0 then return false; end if;
    v_has_paid := v_item ? 'paidAmount';
    v_has_balance := v_item ? 'balanceAmount';
    if v_has_paid is distinct from v_has_balance then return false; end if;
    -- Version-1 invoices omitted both payment fields. Keep those legacy records valid,
    -- but require a complete and internally consistent pair for recorded payments.
    if not v_has_paid then
      if v_item ->> 'status' = 'partial' then return false; end if;
    else
      if pg_catalog.jsonb_typeof(v_item -> 'paidAmount') is distinct from 'number'
        or pg_catalog.jsonb_typeof(v_item -> 'balanceAmount') is distinct from 'number' then
        return false;
      end if;
      v_paid := (v_item ->> 'paidAmount')::numeric;
      v_balance := (v_item ->> 'balanceAmount')::numeric;
      if v_paid < 0 or v_balance < 0 or v_paid > v_total or v_balance > v_total
        or pg_catalog.abs(v_paid + v_balance - v_total) > 0.005 then
        return false;
      end if;
      if v_item ->> 'status' = 'paid' and v_balance > 0.005 then return false; end if;
      if v_item ->> 'status' = 'partial' and (v_paid <= 0 or v_balance <= 0) then return false; end if;
      if v_item ->> 'status' = 'unpaid'
        and (v_paid > 0.005 or pg_catalog.abs(v_balance - v_total) > 0.005) then
        return false;
      end if;
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

commit;
