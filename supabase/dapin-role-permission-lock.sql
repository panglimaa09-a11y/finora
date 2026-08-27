begin;

insert into public.dapin_role_permissions(role, permission)
values ('super_admin', 'dapin.employment.manage')
on conflict (role, permission) do nothing;

create or replace function public.dapin_update_member_employment(
  p_member_id uuid,
  p_department text default null,
  p_position text default null,
  p_employee_status text default null,
  p_join_date date default null,
  p_approval_status text default null
)
returns public.dapin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.dapin_members;
begin
  if auth.uid() is null then
    raise exception 'AUTH_USER_REQUIRED';
  end if;

  if not public.dapin_has_permission('dapin.employment.manage')
     or not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'super_admin'
     ) then
    raise exception 'DAPIN_SUPER_ADMIN_REQUIRED';
  end if;

  if p_member_id is null then
    raise exception 'MEMBER_ID_REQUIRED';
  end if;

  if p_employee_status is not null
     and p_employee_status not in ('pending','active','inactive','terminated') then
    raise exception 'INVALID_EMPLOYEE_STATUS';
  end if;

  if p_approval_status is not null
     and p_approval_status not in ('pending','approved','rejected') then
    raise exception 'INVALID_APPROVAL_STATUS';
  end if;

  update public.dapin_members
  set
    department = coalesce(nullif(btrim(p_department), ''), department),
    position = coalesce(nullif(btrim(p_position), ''), position),
    employee_status = coalesce(p_employee_status, employee_status),
    join_date = coalesce(p_join_date, join_date),
    approval_status = coalesce(p_approval_status, approval_status),
    updated_at = now()
  where id = p_member_id
  returning * into r;

  if r.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  return r;
end;
$$;

grant execute on function public.dapin_update_member_employment(uuid,text,text,text,date,text) to authenticated;

commit;
