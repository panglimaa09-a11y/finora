-- DAPIN ADMIN ROLE MANAGEMENT
-- Scope: DAPIN role assignment only. FINORA Wallet/Core tables untouched.

begin;

create or replace function public.dapin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
  caller_role text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_USER_REQUIRED';
  end if;

  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role <> 'super_admin' then
    raise exception 'DAPIN_SUPER_ADMIN_REQUIRED';
  end if;

  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if p_role not in ('member','admin') then
    raise exception 'INVALID_ASSIGNABLE_ROLE';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id
  returning * into r;

  if r.id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return r;
end;
$$;

grant execute on function public.dapin_set_user_role(uuid,text) to authenticated;

commit;
