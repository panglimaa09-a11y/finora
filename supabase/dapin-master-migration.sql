-- ================================================================
-- DAPIN MASTER MIGRATION
-- Scope: DAPIN only. FINORA Wallet/Core tables are NOT modified.
-- Purpose:
--   1) self-registration for members (email / Google)
--   2) automatic user_id linking by authenticated email
--   3) admin-managed employee fields
--   4) multi-document storage + private document access
--   5) collateral data
--   6) safe DAPIN RLS + RPCs for the above
--
-- Run once in Supabase SQL Editor after the existing DAPIN schema.
-- This migration is designed to be re-runnable.
-- ================================================================

begin;

-- ---------------------------------------------------------------
-- 1. Employee / approval fields
-- ---------------------------------------------------------------
alter table if exists public.dapin_members
  add column if not exists department text,
  add column if not exists position text,
  add column if not exists employee_status text default 'pending',
  add column if not exists join_date date,
  add column if not exists approval_status text default 'pending';

-- Existing rows should remain usable; new self-registered accounts begin pending.
update public.dapin_members
set employee_status = coalesce(nullif(btrim(employee_status), ''), 'pending'),
    approval_status = coalesce(nullif(btrim(approval_status), ''), 'pending')
where employee_status is null or approval_status is null;

alter table public.dapin_members
  drop constraint if exists dapin_members_employee_status_check;
alter table public.dapin_members
  add constraint dapin_members_employee_status_check
  check (employee_status in ('pending','active','inactive','terminated'));

alter table public.dapin_members
  drop constraint if exists dapin_members_approval_status_check;
alter table public.dapin_members
  add constraint dapin_members_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

create index if not exists idx_dapin_members_department
  on public.dapin_members(department);
create index if not exists idx_dapin_members_approval_status
  on public.dapin_members(approval_status);
create unique index if not exists uq_dapin_members_user_id
  on public.dapin_members(user_id)
  where user_id is not null;

-- ---------------------------------------------------------------
-- 2. Role/permission catalog (DAPIN only)
-- ---------------------------------------------------------------
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
create policy dapin_role_permissions_select
on public.dapin_role_permissions
for select using (public.is_admin());

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

-- ---------------------------------------------------------------
-- 3. Self-registration / automatic account linking
-- ---------------------------------------------------------------
create or replace function public.dapin_register_current_user_member(
  p_name text default null,
  p_phone text default null,
  p_address text default null
)
returns public.dapin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email_value text;
  existing_row public.dapin_members;
  created_row public.dapin_members;
begin
  if uid is null then
    raise exception 'AUTH_USER_REQUIRED';
  end if;

  select lower(trim(u.email))
    into email_value
  from auth.users u
  where u.id = uid;

  if email_value is null or email_value = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;

  select * into existing_row
  from public.dapin_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if existing_row.id is not null then
    return existing_row;
  end if;

  select * into existing_row
  from public.dapin_members
  where user_id is null
    and email is not null
    and lower(trim(email)) = email_value
  order by created_at asc
  limit 1;

  if existing_row.id is not null then
    update public.dapin_members
       set user_id = uid,
           updated_at = now()
     where id = existing_row.id
    returning * into existing_row;
    return existing_row;
  end if;

  insert into public.dapin_members(
    user_id,
    email,
    name,
    phone,
    address,
    status,
    approval_status,
    employee_status,
    joined_at
  )
  values (
    uid,
    email_value,
    coalesce(nullif(btrim(p_name),''), split_part(email_value,'@',1)),
    nullif(btrim(p_phone),''),
    nullif(btrim(p_address),''),
    'active',
    'pending',
    'pending',
    now()
  )
  returning * into created_row;

  return created_row;
end;
$$;

grant execute on function public.dapin_register_current_user_member(text,text,text) to authenticated;

create or replace function public.dapin_link_current_user_member()
returns public.dapin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email_value text;
  r public.dapin_members;
begin
  if uid is null then raise exception 'AUTH_USER_REQUIRED'; end if;

  select lower(trim(u.email)) into email_value
  from auth.users u where u.id = uid;

  if email_value is null or email_value = '' then
    raise exception 'AUTH_EMAIL_REQUIRED';
  end if;

  select * into r
  from public.dapin_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if r.id is not null then return r; end if;

  update public.dapin_members
     set user_id = uid,
         updated_at = now()
   where id = (
     select m.id
     from public.dapin_members m
     where m.user_id is null
       and m.email is not null
       and lower(trim(m.email)) = email_value
     order by m.created_at asc
     limit 1
   )
   returning * into r;

  if r.id is null then
    return public.dapin_register_current_user_member(null,null,null);
  end if;

  return r;
end;
$$;

grant execute on function public.dapin_link_current_user_member() to authenticated;

-- ---------------------------------------------------------------
-- 4. Admin employee profile RPC
-- ---------------------------------------------------------------
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
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then
    raise exception 'DAPIN_PERMISSION_DENIED';
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
     set department = coalesce(nullif(btrim(p_department),''), department),
         position = coalesce(nullif(btrim(p_position),''), position),
         employee_status = coalesce(p_employee_status, employee_status),
         join_date = coalesce(p_join_date, join_date),
         approval_status = coalesce(p_approval_status, approval_status),
         updated_at = now()
   where id = p_member_id
  returning * into r;

  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end;
$$;

grant execute on function public.dapin_update_member_employment(uuid,text,text,text,date,text) to authenticated;

-- ---------------------------------------------------------------
-- 5. Documents: multi-file, private bucket, server RPC metadata
-- ---------------------------------------------------------------
create table if not exists public.dapin_member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.dapin_members(id) on delete cascade,
  document_type text not null check (document_type in ('ktp','kk','photo','other')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  note text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dapin_member_documents_member_id
  on public.dapin_member_documents(member_id);

alter table public.dapin_member_documents enable row level security;

drop policy if exists dapin_member_documents_select on public.dapin_member_documents;
create policy dapin_member_documents_select
on public.dapin_member_documents
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists (
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists dapin_member_documents_admin on public.dapin_member_documents;
create policy dapin_member_documents_admin
on public.dapin_member_documents
for all
using (public.dapin_has_permission('dapin.members.manage'))
with check (public.dapin_has_permission('dapin.members.manage'));

grant select, insert, update, delete
on public.dapin_member_documents to authenticated;

create or replace function public.dapin_add_member_document(
  p_member_id uuid,
  p_document_type text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_note text default null
)
returns public.dapin_member_documents
language plpgsql
security definer
set search_path = public
as $$
declare r public.dapin_member_documents;
begin
  if not public.dapin_has_permission('dapin.members.manage') then
    raise exception 'DAPIN_PERMISSION_DENIED';
  end if;

  if not exists(select 1 from public.dapin_members where id=p_member_id) then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if p_document_type not in ('ktp','kk','photo','other') then
    raise exception 'INVALID_DOCUMENT_TYPE';
  end if;

  insert into public.dapin_member_documents(
    member_id, document_type, file_name, storage_path,
    mime_type, file_size, note, uploaded_by
  )
  values(
    p_member_id, p_document_type, btrim(p_file_name), p_storage_path,
    p_mime_type, p_file_size, nullif(btrim(p_note),''), auth.uid()
  )
  returning * into r;

  return r;
end;
$$;

grant execute on function public.dapin_add_member_document(uuid,text,text,text,text,bigint,text) to authenticated;

-- ---------------------------------------------------------------
-- 6. Collateral / guarantees
-- ---------------------------------------------------------------
create table if not exists public.dapin_collaterals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.dapin_members(id) on delete cascade,
  collateral_type text not null,
  name text not null,
  description text,
  estimated_value numeric(20,2) check (estimated_value is null or estimated_value >= 0),
  document_path text,
  status text not null default 'active' check (status in ('active','released','sold','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dapin_collaterals_member_id
  on public.dapin_collaterals(member_id);

alter table public.dapin_collaterals enable row level security;

drop policy if exists dapin_collaterals_select on public.dapin_collaterals;
create policy dapin_collaterals_select
on public.dapin_collaterals
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists (
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists dapin_collaterals_admin on public.dapin_collaterals;
create policy dapin_collaterals_admin
on public.dapin_collaterals
for all
using (public.dapin_has_permission('dapin.members.manage'))
with check (public.dapin_has_permission('dapin.members.manage'));

grant select, insert, update, delete
on public.dapin_collaterals to authenticated;

create or replace function public.dapin_add_collateral(
  p_member_id uuid,
  p_collateral_type text,
  p_name text,
  p_description text default null,
  p_estimated_value numeric default null,
  p_document_path text default null
)
returns public.dapin_collaterals
language plpgsql
security definer
set search_path = public
as $$
declare r public.dapin_collaterals;
begin
  if not public.dapin_has_permission('dapin.members.manage') then
    raise exception 'DAPIN_PERMISSION_DENIED';
  end if;

  if not exists(select 1 from public.dapin_members where id=p_member_id) then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if nullif(btrim(p_collateral_type),'') is null
     or nullif(btrim(p_name),'') is null then
    raise exception 'COLLATERAL_REQUIRED';
  end if;

  insert into public.dapin_collaterals(
    member_id, collateral_type, name, description,
    estimated_value, document_path, created_by
  )
  values(
    p_member_id, btrim(p_collateral_type), btrim(p_name),
    nullif(btrim(p_description),''), p_estimated_value,
    nullif(btrim(p_document_path),''), auth.uid()
  )
  returning * into r;

  return r;
end;
$$;

grant execute on function public.dapin_add_collateral(uuid,text,text,text,numeric,text) to authenticated;

-- ---------------------------------------------------------------
-- 7. Private document bucket + one INSERT policy
-- ---------------------------------------------------------------
insert into storage.buckets(id,name,public)
values('dapin-documents','dapin-documents',false)
on conflict (id) do update set public=false;

drop policy if exists dapin_documents_read on storage.objects;
create policy dapin_documents_read
on storage.objects
for select
to authenticated
using (
  bucket_id='dapin-documents'
  and (
    public.dapin_has_permission('dapin.read.all')
    or exists(
      select 1 from public.dapin_members m
      where m.id = nullif(split_part(storage.objects.name,'/',1),'')::uuid
        and m.user_id = auth.uid()
    )
  )
);

drop policy if exists dapin_documents_insert on storage.objects;
create policy dapin_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='dapin-documents'
  and public.dapin_has_permission('dapin.members.manage')
);

drop policy if exists dapin_documents_update on storage.objects;
create policy dapin_documents_update
on storage.objects
for update
to authenticated
using (
  bucket_id='dapin-documents'
  and public.dapin_has_permission('dapin.members.manage')
)
with check (
  bucket_id='dapin-documents'
  and public.dapin_has_permission('dapin.members.manage')
);

drop policy if exists dapin_documents_delete on storage.objects;
create policy dapin_documents_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='dapin-documents'
  and public.dapin_has_permission('dapin.members.manage')
);

-- Remove any historical duplicate DAPIN INSERT policies.
drop policy if exists dapin_documents_write on storage.objects;

-- ---------------------------------------------------------------
-- 8. Strict member visibility for DAPIN business data
-- ---------------------------------------------------------------
-- Members can see their own member profile. Financial data remains
-- visible to own account only after admin approval.

drop policy if exists dapin_members_select on public.dapin_members;
create policy dapin_members_select
on public.dapin_members
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or user_id = auth.uid()
);

drop policy if exists dapin_savings_select on public.dapin_savings;
create policy dapin_savings_select
on public.dapin_savings
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists(
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
      and m.approval_status = 'approved'
  )
);

drop policy if exists dapin_loans_select on public.dapin_loans;
create policy dapin_loans_select
on public.dapin_loans
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists(
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
      and m.approval_status = 'approved'
  )
);

drop policy if exists dapin_loan_payments_select on public.dapin_loan_payments;
create policy dapin_loan_payments_select
on public.dapin_loan_payments
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists(
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
      and m.approval_status = 'approved'
  )
);

drop policy if exists dapin_transactions_select on public.dapin_transactions;
create policy dapin_transactions_select
on public.dapin_transactions
for select
using (
  public.dapin_has_permission('dapin.read.all')
  or exists(
    select 1 from public.dapin_members m
    where m.id = member_id
      and m.user_id = auth.uid()
      and m.approval_status = 'approved'
  )
);

commit;

-- ================================================================
-- END DAPIN MASTER MIGRATION
-- ================================================================
