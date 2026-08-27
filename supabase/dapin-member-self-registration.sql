-- DAPIN MEMBER SELF REGISTRATION + EMPLOYMENT DATA
-- Scope: DAPIN only. FINORA Wallet/Core is untouched.
-- Run once in Supabase SQL Editor.

alter table public.dapin_members
  add column if not exists department text,
  add column if not exists position text,
  add column if not exists employee_status text,
  add column if not exists join_date date;

create index if not exists idx_dapin_members_department
  on public.dapin_members(department)
  where department is not null;

-- A logged-in user can automatically become/link to a DAPIN member.
-- The match is exact on the authenticated email. If no member exists,
-- a new DAPIN member is created for that user. No role is changed.
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
  user_name text;
  match_count integer;
  member_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_USER_REQUIRED';
  end if;

  select lower(trim(u.email)),
         coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1))
    into user_email, user_name
  from auth.users u
  where u.id = uid;

  if user_email is null or user_email = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;

  select count(*), min(m.id)
    into match_count, member_id
  from public.dapin_members m
  where lower(trim(coalesce(m.email, ''))) = user_email;

  if match_count > 1 then
    raise exception 'DAPIN_MEMBER_EMAIL_AMBIGUOUS';
  end if;

  if match_count = 1 then
    update public.dapin_members
       set user_id = uid,
           updated_at = now()
     where id = member_id
       and (user_id is null or user_id = uid)
    returning * into r;

    if r.id is null then
      raise exception 'DAPIN_MEMBER_ALREADY_LINKED';
    end if;

    return r;
  end if;

  insert into public.dapin_members (
    user_id,
    name,
    email,
    status,
    joined_at,
    created_at,
    updated_at
  )
  values (
    uid,
    user_name,
    user_email,
    'active',
    now(),
    now(),
    now()
  )
  returning * into r;

  return r;
end;
$$;

grant execute on function public.dapin_link_current_user_member() to authenticated;

-- Admin-only employment/profile assignment. Existing profile RPC remains untouched.
create or replace function public.dapin_update_member_employment(
  p_member_id uuid,
  p_department text default null,
  p_position text default null,
  p_employee_status text default null,
  p_join_date date default null
)
returns public.dapin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then
    raise exception 'DAPIN_PERMISSION_DENIED';
  end if;

  update public.dapin_members
     set department = coalesce(nullif(btrim(p_department), ''), department),
         position = coalesce(nullif(btrim(p_position), ''), position),
         employee_status = coalesce(nullif(btrim(p_employee_status), ''), employee_status),
         join_date = coalesce(p_join_date, join_date),
         updated_at = now()
   where id = p_member_id
  returning * into r;

  if r.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  return r;
end;
$$;

grant execute on function public.dapin_update_member_employment(uuid,text,text,text,date) to authenticated;
