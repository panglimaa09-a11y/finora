-- DAPIN ADMIN OPERATIONS
-- Scope: DAPIN only. FINORA Wallet/Core is intentionally untouched.
-- Run after supabase/dapin-security.sql.

create or replace function public.dapin_update_member(
  p_member_id uuid,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_status text default null
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_status is not null and p_status not in ('active','inactive','suspended') then raise exception 'INVALID_MEMBER_STATUS'; end if;
  update public.dapin_members
  set name=coalesce(nullif(btrim(p_name),''),name),
      email=case when p_email is null then email else nullif(btrim(p_email),'') end,
      phone=case when p_phone is null then phone else nullif(btrim(p_phone),'') end,
      address=case when p_address is null then address else nullif(btrim(p_address),'') end,
      status=coalesce(p_status,status),
      updated_at=now()
  where id=p_member_id
  returning * into r;
  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_update_member(uuid,text,text,text,text,text) to authenticated;

create or replace function public.dapin_set_loan_status(
  p_loan_id uuid,
  p_status text
) returns public.dapin_loans
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_loans;
begin
  if not public.dapin_has_permission('dapin.loans.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_status not in ('draft','submitted','approved','active','rejected','lunas','cancelled') then raise exception 'INVALID_LOAN_STATUS'; end if;
  update public.dapin_loans
  set status=p_status, updated_at=now()
  where id=p_loan_id
  returning * into r;
  if r.id is null then raise exception 'LOAN_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_set_loan_status(uuid,text) to authenticated;

create or replace function public.dapin_set_member_status(
  p_member_id uuid,
  p_status text
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'INVALID_MEMBER_STATUS'; end if;
  update public.dapin_members set status=p_status, updated_at=now() where id=p_member_id returning * into r;
  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_set_member_status(uuid,text) to authenticated;
