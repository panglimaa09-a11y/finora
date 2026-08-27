-- DAPIN SECURITY HARDENING
-- Scope: DAPIN only. FINORA Wallet/Core tables are intentionally untouched.
-- Run this after the existing DAPIN schema + dapin-ids migration.

-- 1) Role permissions: central authorization for DAPIN operations.
create table if not exists public.dapin_role_permissions (
  role text not null check (role in ('member','admin','super_admin')),
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

insert into public.dapin_role_permissions(role, permission) values
  ('member','dapin.read.own'),
  ('admin','dapin.read.all'),
  ('admin','dapin.members.manage'),
  ('admin','dapin.savings.manage'),
  ('admin','dapin.loans.manage'),
  ('admin','dapin.payments.manage'),
  ('admin','dapin.transactions.manage'),
  ('admin','dapin.reports.read'),
  ('super_admin','dapin.read.all'),
  ('super_admin','dapin.members.manage'),
  ('super_admin','dapin.savings.manage'),
  ('super_admin','dapin.loans.manage'),
  ('super_admin','dapin.payments.manage'),
  ('super_admin','dapin.transactions.manage'),
  ('super_admin','dapin.reports.read'),
  ('super_admin','dapin.roles.manage')
on conflict do nothing;

alter table public.dapin_role_permissions enable row level security;
drop policy if exists dapin_role_permissions_select on public.dapin_role_permissions;
create policy dapin_role_permissions_select on public.dapin_role_permissions
  for select using (public.is_admin());

create or replace function public.dapin_has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.dapin_role_permissions rp on rp.role=p.role
    where p.id=auth.uid() and rp.permission=p_permission
  );
$$;

grant execute on function public.dapin_has_permission(text) to authenticated;

-- 2) Tighten profiles: admin UI must not be able to arbitrarily rewrite roles.
drop policy if exists profiles_admin_manage on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid()=id) with check (auth.uid()=id);

-- Role changes must be made by a trusted backend/service process, not browser SQL writes.
revoke insert, update, delete on public.profiles from authenticated;

-- 3) Lock down direct DAPIN writes. UI will use security-definer RPCs below.
drop policy if exists dapin_members_admin on public.dapin_members;
drop policy if exists dapin_savings_admin on public.dapin_savings;
drop policy if exists dapin_loans_admin on public.dapin_loans;
drop policy if exists dapin_loan_payments_admin on public.dapin_loan_payments;
drop policy if exists dapin_transactions_admin on public.dapin_transactions;

drop policy if exists dapin_members_select on public.dapin_members;
create policy dapin_members_select on public.dapin_members
  for select using (public.dapin_has_permission('dapin.read.all') or user_id=auth.uid());

drop policy if exists dapin_savings_select on public.dapin_savings;
create policy dapin_savings_select on public.dapin_savings
  for select using (
    public.dapin_has_permission('dapin.read.all')
    or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
  );

drop policy if exists dapin_loans_select on public.dapin_loans;
create policy dapin_loans_select on public.dapin_loans
  for select using (
    public.dapin_has_permission('dapin.read.all')
    or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
  );

drop policy if exists dapin_loan_payments_select on public.dapin_loan_payments;
create policy dapin_loan_payments_select on public.dapin_loan_payments
  for select using (
    public.dapin_has_permission('dapin.read.all')
    or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
  );

drop policy if exists dapin_transactions_select on public.dapin_transactions;
create policy dapin_transactions_select on public.dapin_transactions
  for select using (
    public.dapin_has_permission('dapin.read.all')
    or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
  );

revoke insert, update, delete on public.dapin_members, public.dapin_savings, public.dapin_loans, public.dapin_loan_payments, public.dapin_transactions from authenticated;

-- 4) Automatically generate human-readable member code if omitted.
create or replace function public.set_dapin_member_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code)='' then
    if new.member_no is null then new.member_no := nextval('public.dapin_member_no_seq'); end if;
    new.code := 'DAP-' || lpad(new.member_no::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists dapin_members_assign_code on public.dapin_members;
create trigger dapin_members_assign_code
before insert on public.dapin_members
for each row execute function public.set_dapin_member_code();

-- 5) Audit trigger. Every DAPIN insert/update/delete is recorded.
create or replace function public.audit_dapin_change()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  payload jsonb;
  entity uuid;
begin
  entity := coalesce(new.id, old.id);
  payload := jsonb_build_object(
    'table_name', TG_TABLE_NAME,
    'operation', TG_OP,
    'new', case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    'old', case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end
  );
  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'DAPIN_'||TG_OP, TG_TABLE_NAME, entity, payload);
  return coalesce(new, old);
end $$;

drop trigger if exists dapin_members_audit on public.dapin_members;
create trigger dapin_members_audit after insert or update or delete on public.dapin_members
for each row execute function public.audit_dapin_change();
drop trigger if exists dapin_savings_audit on public.dapin_savings;
create trigger dapin_savings_audit after insert or update or delete on public.dapin_savings
for each row execute function public.audit_dapin_change();
drop trigger if exists dapin_loans_audit on public.dapin_loans;
create trigger dapin_loans_audit after insert or update or delete on public.dapin_loans
for each row execute function public.audit_dapin_change();
drop trigger if exists dapin_loan_payments_audit on public.dapin_loan_payments;
create trigger dapin_loan_payments_audit after insert or update or delete on public.dapin_loan_payments
for each row execute function public.audit_dapin_change();
drop trigger if exists dapin_transactions_audit on public.dapin_transactions;
create trigger dapin_transactions_audit after insert or update or delete on public.dapin_transactions
for each row execute function public.audit_dapin_change();

-- 6) Restrict audit/security visibility to administrators.
alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_admin());
drop policy if exists security_events_admin_select on public.security_events;
create policy security_events_admin_select on public.security_events for select using (public.is_admin());
revoke select, insert, update, delete on public.audit_logs, public.security_events from authenticated;
grant select on public.audit_logs, public.security_events to authenticated;

-- 7) Secure RPCs: browser can request an operation, but DB checks permission first.
create or replace function public.dapin_create_member(
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_joined_at timestamptz default now()
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  insert into public.dapin_members(name,email,phone,address,joined_at,user_id)
  values (btrim(p_name), nullif(btrim(p_email),''), nullif(btrim(p_phone),''), nullif(btrim(p_address),''), coalesce(p_joined_at,now()), null)
  returning * into r;
  return r;
end $$;

grant execute on function public.dapin_create_member(text,text,text,text,timestamptz) to authenticated;

create or replace function public.dapin_record_saving(
  p_member_id uuid,
  p_type text,
  p_amount numeric,
  p_note text default null
) returns public.dapin_savings
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_savings;
begin
  if not public.dapin_has_permission('dapin.savings.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_savings(member_id,type,amount,note,created_by)
  values(p_member_id,p_type,p_amount,nullif(btrim(p_note),''),auth.uid()) returning * into r;
  return r;
end $$;
grant execute on function public.dapin_record_saving(uuid,text,numeric,text) to authenticated;

create or replace function public.dapin_create_loan(
  p_member_id uuid,
  p_amount numeric,
  p_tenor integer,
  p_status text default 'submitted',
  p_note text default null
) returns public.dapin_loans
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_loans;
begin
  if not public.dapin_has_permission('dapin.loans.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount <= 0 or p_tenor <= 0 then raise exception 'INVALID_LOAN'; end if;
  if not exists (select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_loans(member_id,amount,tenor,status,note,created_by)
  values(p_member_id,p_amount,p_tenor,p_status,nullif(btrim(p_note),''),auth.uid()) returning * into r;
  return r;
end $$;
grant execute on function public.dapin_create_loan(uuid,numeric,integer,text,text) to authenticated;

create or replace function public.dapin_record_payment(
  p_loan_id uuid,
  p_amount numeric,
  p_method text default 'Tunai',
  p_note text default null
) returns public.dapin_loan_payments
language plpgsql security definer set search_path=public
as $$
declare
  r public.dapin_loan_payments;
  l public.dapin_loans;
  remaining numeric;
begin
  if not public.dapin_has_permission('dapin.payments.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.dapin_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'LOAN_NOT_FOUND'; end if;
  remaining := l.amount - l.paid;
  if p_amount > remaining then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
  insert into public.dapin_loan_payments(loan_id,member_id,amount,method,note,created_by)
  values(l.id,l.member_id,p_amount,coalesce(nullif(btrim(p_method),''),'Tunai'),nullif(btrim(p_note),''),auth.uid())
  returning * into r;
  update public.dapin_loans
  set paid=paid+p_amount,
      status=case when paid+p_amount >= amount then 'lunas' else status end,
      updated_at=now()
  where id=l.id;
  return r;
end $$;
grant execute on function public.dapin_record_payment(uuid,numeric,text,text) to authenticated;

create or replace function public.dapin_record_transaction(
  p_label text,
  p_amount numeric,
  p_direction text,
  p_member_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
) returns public.dapin_transactions
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_transactions;
begin
  if not public.dapin_has_permission('dapin.transactions.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount <= 0 or p_direction not in ('in','out') then raise exception 'INVALID_TRANSACTION'; end if;
  if p_member_id is not null and not exists (select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_transactions(member_id,label,amount,direction,reference_type,reference_id,note,created_by)
  values(p_member_id,btrim(p_label),p_amount,p_direction,p_reference_type,p_reference_id,nullif(btrim(p_note),''),auth.uid())
  returning * into r;
  return r;
end $$;
grant execute on function public.dapin_record_transaction(text,numeric,text,uuid,text,uuid,text) to authenticated;

-- 8) Member-safe self profile link: a member can see/update only their own contact details through RPC.
create or replace function public.dapin_update_my_member(
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  update public.dapin_members
  set name=coalesce(nullif(btrim(p_name),''),name),
      email=coalesce(nullif(btrim(p_email),''),email),
      phone=coalesce(nullif(btrim(p_phone),''),phone),
      address=coalesce(nullif(btrim(p_address),''),address),
      updated_at=now()
  where user_id=auth.uid()
  returning * into r;
  if r.id is null then raise exception 'MEMBER_PROFILE_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_update_my_member(text,text,text,text) to authenticated;

-- 9) Ensure DAPIN public table columns remain readable by authenticated users; writes stay RPC-only.
grant select on public.dapin_role_permissions, public.dapin_members, public.dapin_savings, public.dapin_loans, public.dapin_loan_payments, public.dapin_transactions to authenticated;
