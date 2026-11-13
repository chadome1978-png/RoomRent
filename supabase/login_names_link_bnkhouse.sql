-- Run only after replacing the placeholder with the verified email address
-- of the Supabase Auth account that should own username bnkhouse.
-- This script links an existing account. It does not create users or store passwords.

do $$
declare
  target_user_id uuid;
  existing_username text;
  username_owner uuid;
begin
  select id
    into target_user_id
    from auth.users
   where lower(email) = lower('REPLACE_WITH_VERIFIED_EMAIL')
     and email_confirmed_at is not null;

  if target_user_id is null then
    raise exception 'No verified Supabase Auth account found for the supplied email';
  end if;

  select user_id
    into username_owner
    from public.login_names
   where username = 'bnkhouse';

  if username_owner is not null and username_owner <> target_user_id then
    raise exception 'Username bnkhouse is already assigned to a different Auth user';
  end if;

  select username
    into existing_username
    from public.login_names
   where user_id = target_user_id;

  if existing_username is not null and existing_username <> 'bnkhouse' then
    raise exception 'This Auth user already has a different username mapping';
  end if;

  insert into public.login_names (user_id, username)
  values (target_user_id, 'bnkhouse')
  on conflict (user_id) do nothing;
end;
$$;
