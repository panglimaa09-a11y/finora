begin;

-- =========================================================
-- DAPIN ROLE SYSTEM
-- Roles: member, hr, admin, finance, super_admin
-- Super Admin is the only role that can assign roles.
-- =========================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member','hr','admin','finance','super_admin'));

alter table public.profiles
  alter column role set default 'member';

create table if not exists public.dapin_role_permissions (
  role text not null,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

insert into public.dapin_role_permissions(role, permission) values
('member','dapin.read.own'),

('hr','dapin.read.all'),
('hr','dapin.members.manage'),
('hr','dapin.employment.read'),
('hr','dapin.employment.manage'),
('hr','dapin.documents.read'),
('hr','dapin.documents.manage'),
('hr','dapin.collaterals.read'),

('admin','dapin.read.all'),
('admin','dapin.members.manage'),
('admin','dapin.documents.read'),
('admin','dapin.documents.manage'),
('admin','dapin.collaterals.read'),
('admin','dapin.savings.manage'),
('admin','dapin.loans.manage'),
('admin','dapin.payments.manage'),
('admin','dapin.transactions.manage'),
('admin','dapin.reports.read'),

('finance','dapin.read.all'),
('finance','dapin.members.read'),
('finance','dapin.savings.manage'),
('finance','dapin.loans.manage'),
('finance','dapin.payments.manage'),
('finance','dapin.transactions.manage'),
('finance','dapin.reports.read'),

('super_admin','dapin.read.all'),
('super_admin','dapin.members.manage'),
('super_admin','dapin.employment.read'),
('super_admin','dapin.employment.manage'),
('super_admin','dapin.documents.read'),
('super_admin','dapin.documents.manage'),
('super_admin','dapin.collaterals.read'),
('super_admin','dapin.collaterals.manage'),
('super_admin','dapin.savings.manage'),
('super_admin','dapin.loans.manage'),
('super_admin','dapin.payments.manage'),
('super_admin','dapin.transactions.manage'),
('super_admin','dapin.reports.read'),
('super_admin','dapin.roles.manage')
on conflict (role, permission) do nothing;

create or replace function public.dapin_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select lower(role) from public.profiles where id = auth.uid()), 'member');
$$;

grant execute on function public.dapin_current_role() to authenticated;

create or replace function public.dapin_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.dapin_role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
      and rp.permission = p_permission
  );
$$;

grant execute on function public.dapin_has_permission(text) to authenticated;

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
  if auth.uid() is null then raise exception 'AUTH_USER_REQUIRED'; end if;

  select lower(role) into caller_role
  from public.profiles where id = auth.uid();

  if caller_role <> 'super_admin' then
    raise exception 'DAPIN_SUPER_ADMIN_REQUIRED';
  end if;

  if p_user_id is null then raise exception 'USER_ID_REQUIRED'; end if;
  if p_role not in ('member','hr','admin','finance') then
    raise exception 'INVALID_ASSIGNABLE_ROLE';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id
  returning * into r;

  if r.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  return r;
end;
$$;

grant execute on function public.dapin_set_user_role(uuid,text) to authenticated;

-- Existing role values remain valid. No automatic promotion is performed.

commit;
