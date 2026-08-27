-- DAPIN MEMBER AUTO-LINK
-- Scope: DAPIN only. FINORA Wallet/Core tables are untouched.
-- Run once in Supabase SQL Editor.

create or replace function public.dapin_link_current_user_member()
returns public.dapin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.dapin_members;
  uid uuid := auth.uid();
  user_email text;
  match_count integer;
  member_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_USER_REQUIRED';
  end if;

  select lower(trim(u.email))
    into user_email
  from auth.users u
  where u.id = uid;

  if user_email is null or user_email = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;

  select count(*), min(m.id)
    into match_count, member_id
  from public.dapin_members m
  where m.user_id is null
    and m.email is not null
    and lower(trim(m.email)) = user_email;

  if match_count = 0 then
    return null;
  end if;

  if match_count > 1 then
    raise exception 'DAPIN_MEMBER_EMAIL_AMBIGUOUS';
  end if;

  update public.dapin_members
  set user_id = uid,
      updated_at = now()
  where id = member_id
    and user_id is null
  returning * into r;

  return r;
end;
$$;

grant execute on function public.dapin_link_current_user_member() to authenticated;

-- Optional: when an admin creates a member with an email that already belongs
-- to a profile, the existing account can be linked by the login-time function.
-- This avoids requiring manual SQL per member and does not grant extra access.
