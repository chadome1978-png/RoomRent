begin;

-- Internal storage is not part of PostgREST's exposed schemas and has no client grants.
create schema if not exists roomrent_internal;
revoke all on schema roomrent_internal from public, anon, authenticated, service_role;

create table if not exists roomrent_internal.username_login_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 1),
  updated_at timestamptz not null,
  constraint username_login_limits_bucket_key_format
    check (bucket_key ~ '^(ip|username):[0-9a-f]{64}$')
);

create index if not exists username_login_limits_updated_at_idx
  on roomrent_internal.username_login_limits (updated_at);

alter table roomrent_internal.username_login_limits enable row level security;
revoke all on table roomrent_internal.username_login_limits
  from public, anon, authenticated, service_role;

-- Atomic fixed-window counters. The Edge Function supplies HMAC-SHA256 hashes only.
-- IP: 20 attempts / 5 minutes. Username: 10 attempts / 15 minutes.
-- Old hashes are removed after 24 hours to bound retention.
create or replace function public.consume_roomrent_username_login_rate_limit(
  p_ip_hash text,
  p_username_hash text
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_ip_attempts integer;
  v_ip_window timestamptz;
  v_username_attempts integer;
  v_username_window timestamptz;
  v_retry_after integer := 0;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_username_hash is null or p_username_hash !~ '^[0-9a-f]{64}$' then
    return query select false, 300;
    return;
  end if;

  insert into roomrent_internal.username_login_limits as existing (
    bucket_key, window_started_at, attempts, updated_at
  ) values (
    'ip:' || p_ip_hash, v_now, 1, v_now
  )
  on conflict (bucket_key) do update
    set window_started_at = case
          when existing.window_started_at <= v_now - interval '5 minutes' then v_now
          else existing.window_started_at
        end,
        attempts = case
          when existing.window_started_at <= v_now - interval '5 minutes' then 1
          else existing.attempts + 1
        end,
        updated_at = v_now
  returning attempts, window_started_at into v_ip_attempts, v_ip_window;

  insert into roomrent_internal.username_login_limits as existing (
    bucket_key, window_started_at, attempts, updated_at
  ) values (
    'username:' || p_username_hash, v_now, 1, v_now
  )
  on conflict (bucket_key) do update
    set window_started_at = case
          when existing.window_started_at <= v_now - interval '15 minutes' then v_now
          else existing.window_started_at
        end,
        attempts = case
          when existing.window_started_at <= v_now - interval '15 minutes' then 1
          else existing.attempts + 1
        end,
        updated_at = v_now
  returning attempts, window_started_at into v_username_attempts, v_username_window;

  if v_ip_attempts > 20 then
    v_retry_after := greatest(
      v_retry_after,
      ceil(extract(epoch from (v_ip_window + interval '5 minutes' - v_now))::numeric)::integer
    );
  end if;

  if v_username_attempts > 10 then
    v_retry_after := greatest(
      v_retry_after,
      ceil(extract(epoch from (v_username_window + interval '15 minutes' - v_now))::numeric)::integer
    );
  end if;

  delete from roomrent_internal.username_login_limits
  where updated_at < v_now - interval '24 hours';

  return query select v_retry_after = 0, greatest(v_retry_after, 0);
end;
$function$;

revoke all on function public.consume_roomrent_username_login_rate_limit(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_roomrent_username_login_rate_limit(text, text)
  to service_role;

commit;
