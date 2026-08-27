-- DAPIN FULL DATABASE SETUP
-- Scope: DAPIN only. Existing FINORA Wallet/Core tables are intentionally untouched.
-- Safe to run more than once after the original DAPIN schema exists.
-- Run this file in Supabase SQL Editor.

begin;

-- =========================================================
-- 1. Existing member table: add profile fields if missing
-- =========================================================
alter table if exists public.dapin_members
  add column if not exists nik text,
  add column if not exists kk_number text,
  add column if not exists birth_place text,
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists occupation text,
  add column if not exists marital_status text;

-- =========================================================
-- 2. Role/permission catalog
-- =========================================================
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
    join public.dapin_role_permissions rp on rp.role = p.role
    where p.id = auth.uid() and rp.permission = p_permission
  );
$$;

grant execute on function public.dapin_has_permission(text) to authenticated;

-- =========================================================
-- 3. ID sequences and automatic human-readable IDs
-- =========================================================
create sequence if not exists public.dapin_member_no_seq;
create sequence if not exists public.dapin_savings_no_seq;
create sequence if not exists public.dapin_loan_no_seq;
create sequence if not exists public.dapin_payment_no_seq;
create sequence if not exists public.dapin_transaction_no_seq;

alter table if exists public.dapin_members add column if not exists member_no bigint;
alter table if exists public.dapin_members add column if not exists display_id text;
alter table if exists public.dapin_savings add column if not exists record_no bigint;
alter table if exists public.dapin_savings add column if not exists display_id text;
alter table if exists public.dapin_loans add column if not exists loan_no bigint;
alter table if exists public.dapin_loans add column if not exists display_id text;
alter table if exists public.dapin_loan_payments add column if not exists payment_no bigint;
alter table if exists public.dapin_loan_payments add column if not exists display_id text;
alter table if exists public.dapin_transactions add column if not exists transaction_no bigint;
alter table if exists public.dapin_transactions add column if not exists display_id text;

update public.dapin_members set member_no = nextval('public.dapin_member_no_seq') where member_no is null;
update public.dapin_savings set record_no = nextval('public.dapin_savings_no_seq') where record_no is null;
update public.dapin_loans set loan_no = nextval('public.dapin_loan_no_seq') where loan_no is null;
update public.dapin_loan_payments set payment_no = nextval('public.dapin_payment_no_seq') where payment_no is null;
update public.dapin_transactions set transaction_no = nextval('public.dapin_transaction_no_seq') where transaction_no is null;

-- Empty tables need the sequence to be positioned just before 1;
-- populated tables continue after their current highest number.
select setval('public.dapin_member_no_seq', greatest(coalesce((select max(member_no) from public.dapin_members),0),1), coalesce((select max(member_no) from public.dapin_members),0) > 0);
select setval('public.dapin_savings_no_seq', greatest(coalesce((select max(record_no) from public.dapin_savings),0),1), coalesce((select max(record_no) from public.dapin_savings),0) > 0);
select setval('public.dapin_loan_no_seq', greatest(coalesce((select max(loan_no) from public.dapin_loans),0),1), coalesce((select max(loan_no) from public.dapin_loans),0) > 0);
select setval('public.dapin_payment_no_seq', greatest(coalesce((select max(payment_no) from public.dapin_loan_payments),0),1), coalesce((select max(payment_no) from public.dapin_loan_payments),0) > 0);
select setval('public.dapin_transaction_no_seq', greatest(coalesce((select max(transaction_no) from public.dapin_transactions),0),1), coalesce((select max(transaction_no) from public.dapin_transactions),0) > 0);

create or replace function public.dapin_assign_ids()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'dapin_members' then
    if new.member_no is null then new.member_no := nextval('public.dapin_member_no_seq'); end if;
    new.display_id := 'DAP-MBR-' || lpad(new.member_no::text,6,'0');
  elsif tg_table_name = 'dapin_savings' then
    if new.record_no is null then new.record_no := nextval('public.dapin_savings_no_seq'); end if;
    new.display_id := 'DAP-SAV-' || lpad(new.record_no::text,6,'0');
  elsif tg_table_name = 'dapin_loans' then
    if new.loan_no is null then new.loan_no := nextval('public.dapin_loan_no_seq'); end if;
    new.display_id := 'DAP-LON-' || lpad(new.loan_no::text,6,'0');
  elsif tg_table_name = 'dapin_loan_payments' then
    if new.payment_no is null then new.payment_no := nextval('public.dapin_payment_no_seq'); end if;
    new.display_id := 'DAP-PAY-' || lpad(new.payment_no::text,6,'0');
  elsif tg_table_name = 'dapin_transactions' then
    if new.transaction_no is null then new.transaction_no := nextval('public.dapin_transaction_no_seq'); end if;
    new.display_id := 'DAP-TXN-' || lpad(new.transaction_no::text,6,'0');
  end if;
  return new;
end $$;

drop trigger if exists dapin_members_assign_ids on public.dapin_members;
create trigger dapin_members_assign_ids before insert on public.dapin_members for each row execute function public.dapin_assign_ids();
drop trigger if exists dapin_savings_assign_ids on public.dapin_savings;
create trigger dapin_savings_assign_ids before insert on public.dapin_savings for each row execute function public.dapin_assign_ids();
drop trigger if exists dapin_loans_assign_ids on public.dapin_loans;
create trigger dapin_loans_assign_ids before insert on public.dapin_loans for each row execute function public.dapin_assign_ids();
drop trigger if exists dapin_loan_payments_assign_ids on public.dapin_loan_payments;
create trigger dapin_loan_payments_assign_ids before insert on public.dapin_loan_payments for each row execute function public.dapin_assign_ids();
drop trigger if exists dapin_transactions_assign_ids on public.dapin_transactions;
create trigger dapin_transactions_assign_ids before insert on public.dapin_transactions for each row execute function public.dapin_assign_ids();

alter table public.dapin_members alter column member_no set not null;
alter table public.dapin_members alter column display_id set not null;
alter table public.dapin_savings alter column record_no set not null;
alter table public.dapin_savings alter column display_id set not null;
alter table public.dapin_loans alter column loan_no set not null;
alter table public.dapin_loans alter column display_id set not null;
alter table public.dapin_loan_payments alter column payment_no set not null;
alter table public.dapin_loan_payments alter column display_id set not null;
alter table public.dapin_transactions alter column transaction_no set not null;
alter table public.dapin_transactions alter column display_id set not null;

create unique index if not exists uq_dapin_members_member_no on public.dapin_members(member_no);
create unique index if not exists uq_dapin_members_display_id on public.dapin_members(display_id);
create unique index if not exists uq_dapin_savings_record_no on public.dapin_savings(record_no);
create unique index if not exists uq_dapin_savings_display_id on public.dapin_savings(display_id);
create unique index if not exists uq_dapin_loans_loan_no on public.dapin_loans(loan_no);
create unique index if not exists uq_dapin_loans_display_id on public.dapin_loans(display_id);
create unique index if not exists uq_dapin_payments_payment_no on public.dapin_loan_payments(payment_no);
create unique index if not exists uq_dapin_payments_display_id on public.dapin_loan_payments(display_id);
create unique index if not exists uq_dapin_transactions_transaction_no on public.dapin_transactions(transaction_no);
create unique index if not exists uq_dapin_transactions_display_id on public.dapin_transactions(display_id);

-- =========================================================
-- 4. Member documents + collateral
-- =========================================================
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

create index if not exists idx_dapin_member_documents_member_id on public.dapin_member_documents(member_id);
create index if not exists idx_dapin_collaterals_member_id on public.dapin_collaterals(member_id);

alter table public.dapin_member_documents enable row level security;
alter table public.dapin_collaterals enable row level security;

drop policy if exists dapin_member_documents_select on public.dapin_member_documents;
create policy dapin_member_documents_select on public.dapin_member_documents
for select using (
  public.dapin_has_permission('dapin.read.all')
  or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
);
drop policy if exists dapin_collaterals_select on public.dapin_collaterals;
create policy dapin_collaterals_select on public.dapin_collaterals
for select using (
  public.dapin_has_permission('dapin.read.all')
  or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
);

revoke insert, update, delete on public.dapin_member_documents, public.dapin_collaterals from authenticated;

create or replace function public.dapin_add_member_document(
  p_member_id uuid, p_document_type text, p_file_name text, p_storage_path text,
  p_mime_type text default null, p_file_size bigint default null, p_note text default null
) returns public.dapin_member_documents
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_member_documents;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  insert into public.dapin_member_documents(member_id,document_type,file_name,storage_path,mime_type,file_size,note,uploaded_by)
  values(p_member_id,p_document_type,p_file_name,p_storage_path,p_mime_type,p_file_size,nullif(btrim(p_note),''),auth.uid())
  returning * into r;
  return r;
end $$;
grant execute on function public.dapin_add_member_document(uuid,text,text,text,text,bigint,text) to authenticated;

create or replace function public.dapin_add_collateral(
  p_member_id uuid, p_collateral_type text, p_name text, p_description text default null,
  p_estimated_value numeric default null, p_document_path text default null
) returns public.dapin_collaterals
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_collaterals;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  insert into public.dapin_collaterals(member_id,collateral_type,name,description,estimated_value,document_path,created_by)
  values(p_member_id,btrim(p_collateral_type),btrim(p_name),nullif(btrim(p_description),''),p_estimated_value,p_document_path,auth.uid())
  returning * into r;
  return r;
end $$;
grant execute on function public.dapin_add_collateral(uuid,text,text,text,numeric,text) to authenticated;

insert into storage.buckets(id,name,public) values('dapin-documents','dapin-documents',false)
on conflict (id) do update set public=false;

drop policy if exists dapin_documents_read on storage.objects;
create policy dapin_documents_read on storage.objects for select using (
  bucket_id='dapin-documents' and (
    public.dapin_has_permission('dapin.read.all')
    or exists (select 1 from public.dapin_members m where m.user_id=auth.uid() and m.id=nullif(split_part(name,'/',1),'')::uuid)
  )
);
drop policy if exists dapin_documents_insert on storage.objects;
create policy dapin_documents_insert on storage.objects for insert with check (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
);
drop policy if exists dapin_documents_update on storage.objects;
create policy dapin_documents_update on storage.objects for update using (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
) with check (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
);
drop policy if exists dapin_documents_delete on storage.objects;
create policy dapin_documents_delete on storage.objects for delete using (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
);

-- =========================================================
-- 5. Strict RLS for DAPIN business tables
-- =========================================================
revoke insert, update, delete on public.dapin_members, public.dapin_savings, public.dapin_loans, public.dapin_loan_payments, public.dapin_transactions from authenticated;
grant select on public.dapin_members, public.dapin_savings, public.dapin_loans, public.dapin_loan_payments, public.dapin_transactions to authenticated;

alter table public.dapin_members enable row level security;
alter table public.dapin_savings enable row level security;
alter table public.dapin_loans enable row level security;
alter table public.dapin_loan_payments enable row level security;
alter table public.dapin_transactions enable row level security;

drop policy if exists dapin_members_select on public.dapin_members;
create policy dapin_members_select on public.dapin_members for select using (public.dapin_has_permission('dapin.read.all') or user_id=auth.uid());
drop policy if exists dapin_savings_select on public.dapin_savings;
create policy dapin_savings_select on public.dapin_savings for select using (public.dapin_has_permission('dapin.read.all') or exists(select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid()));
drop policy if exists dapin_loans_select on public.dapin_loans;
create policy dapin_loans_select on public.dapin_loans for select using (public.dapin_has_permission('dapin.read.all') or exists(select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid()));
drop policy if exists dapin_loan_payments_select on public.dapin_loan_payments;
create policy dapin_loan_payments_select on public.dapin_loan_payments for select using (public.dapin_has_permission('dapin.read.all') or exists(select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid()));
drop policy if exists dapin_transactions_select on public.dapin_transactions;
create policy dapin_transactions_select on public.dapin_transactions for select using (public.dapin_has_permission('dapin.read.all') or exists(select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid()));

-- =========================================================
-- 6. Secure DAPIN RPCs
-- =========================================================
create or replace function public.dapin_create_member(
  p_name text, p_email text default null, p_phone text default null, p_address text default null,
  p_joined_at timestamptz default now(), p_nik text default null, p_kk_number text default null,
  p_birth_place text default null, p_birth_date date default null, p_gender text default null,
  p_occupation text default null, p_marital_status text default null
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'MEMBER_NAME_REQUIRED'; end if;
  insert into public.dapin_members(name,email,phone,address,joined_at,user_id,nik,kk_number,birth_place,birth_date,gender,occupation,marital_status)
  values(btrim(p_name),nullif(btrim(p_email),''),nullif(btrim(p_phone),''),nullif(btrim(p_address),''),coalesce(p_joined_at,now()),null,
         nullif(btrim(p_nik),''),nullif(btrim(p_kk_number),''),nullif(btrim(p_birth_place),''),p_birth_date,
         nullif(btrim(p_gender),''),nullif(btrim(p_occupation),''),nullif(btrim(p_marital_status),''))
  returning * into r;
  return r;
end $$;

grant execute on function public.dapin_create_member(text,text,text,text,timestamptz,text,text,text,date,text,text,text) to authenticated;

create or replace function public.dapin_record_saving(p_member_id uuid,p_type text,p_amount numeric,p_note text default null)
returns public.dapin_savings language plpgsql security definer set search_path=public as $$
declare r public.dapin_savings;
begin
  if not public.dapin_has_permission('dapin.savings.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists(select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_savings(member_id,type,amount,note,created_by)
  values(p_member_id,p_type,p_amount,nullif(btrim(p_note),''),auth.uid()) returning * into r;
  return r;
end $$;
grant execute on function public.dapin_record_saving(uuid,text,numeric,text) to authenticated;

create or replace function public.dapin_create_loan(p_member_id uuid,p_amount numeric,p_tenor integer,p_status text default 'submitted',p_note text default null)
returns public.dapin_loans language plpgsql security definer set search_path=public as $$
declare r public.dapin_loans;
begin
  if not public.dapin_has_permission('dapin.loans.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount is null or p_amount <= 0 or p_tenor is null or p_tenor <= 0 then raise exception 'INVALID_LOAN'; end if;
  if not exists(select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_loans(member_id,amount,tenor,status,note,created_by)
  values(p_member_id,p_amount,p_tenor,p_status,nullif(btrim(p_note),''),auth.uid()) returning * into r;
  return r;
end $$;
grant execute on function public.dapin_create_loan(uuid,numeric,integer,text,text) to authenticated;

create or replace function public.dapin_record_payment(p_loan_id uuid,p_amount numeric,p_method text default 'Tunai',p_note text default null)
returns public.dapin_loan_payments language plpgsql security definer set search_path=public as $$
declare r public.dapin_loan_payments; l public.dapin_loans; remaining numeric;
begin
  if not public.dapin_has_permission('dapin.payments.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.dapin_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'LOAN_NOT_FOUND'; end if;
  remaining := l.amount - l.paid;
  if p_amount > remaining then raise exception 'PAYMENT_EXCEEDS_REMAINING'; end if;
  insert into public.dapin_loan_payments(loan_id,member_id,amount,method,note,created_by)
  values(l.id,l.member_id,p_amount,coalesce(nullif(btrim(p_method),''),'Tunai'),nullif(btrim(p_note),''),auth.uid()) returning * into r;
  update public.dapin_loans set paid=paid+p_amount,status=case when paid+p_amount>=amount then 'lunas' else status end,updated_at=now() where id=l.id;
  return r;
end $$;
grant execute on function public.dapin_record_payment(uuid,numeric,text,text) to authenticated;

create or replace function public.dapin_record_transaction(p_label text,p_amount numeric,p_direction text,p_member_id uuid default null,p_reference_type text default null,p_reference_id uuid default null,p_note text default null)
returns public.dapin_transactions language plpgsql security definer set search_path=public as $$
declare r public.dapin_transactions;
begin
  if not public.dapin_has_permission('dapin.transactions.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_label),'') is null or p_amount is null or p_amount <= 0 or p_direction not in ('in','out') then raise exception 'INVALID_TRANSACTION'; end if;
  if p_member_id is not null and not exists(select 1 from public.dapin_members where id=p_member_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  insert into public.dapin_transactions(member_id,label,amount,direction,reference_type,reference_id,note,created_by)
  values(p_member_id,btrim(p_label),p_amount,p_direction,p_reference_type,p_reference_id,nullif(btrim(p_note),''),auth.uid()) returning * into r;
  return r;
end $$;
grant execute on function public.dapin_record_transaction(text,numeric,text,uuid,text,uuid,text) to authenticated;

create or replace function public.dapin_update_member_profile(
  p_member_id uuid, p_name text default null, p_email text default null, p_phone text default null,
  p_address text default null, p_nik text default null, p_kk_number text default null,
  p_birth_place text default null, p_birth_date date default null, p_gender text default null,
  p_occupation text default null, p_marital_status text default null
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  update public.dapin_members set
    name=coalesce(nullif(btrim(p_name),''),name), email=coalesce(nullif(btrim(p_email),''),email),
    phone=coalesce(nullif(btrim(p_phone),''),phone), address=coalesce(nullif(btrim(p_address),''),address),
    nik=coalesce(nullif(btrim(p_nik),''),nik), kk_number=coalesce(nullif(btrim(p_kk_number),''),kk_number),
    birth_place=coalesce(nullif(btrim(p_birth_place),''),birth_place), birth_date=coalesce(p_birth_date,birth_date),
    gender=coalesce(nullif(btrim(p_gender),''),gender), occupation=coalesce(nullif(btrim(p_occupation),''),occupation),
    marital_status=coalesce(nullif(btrim(p_marital_status),''),marital_status), updated_at=now()
  where id=p_member_id returning * into r;
  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_update_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text) to authenticated;

create or replace function public.dapin_set_member_status(p_member_id uuid,p_status text)
returns public.dapin_members language plpgsql security definer set search_path=public as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'INVALID_MEMBER_STATUS'; end if;
  update public.dapin_members set status=p_status,updated_at=now() where id=p_member_id returning * into r;
  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_set_member_status(uuid,text) to authenticated;

create or replace function public.dapin_set_loan_status(p_loan_id uuid,p_status text)
returns public.dapin_loans language plpgsql security definer set search_path=public as $$
declare r public.dapin_loans;
begin
  if not public.dapin_has_permission('dapin.loans.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_status not in ('draft','submitted','approved','active','rejected','lunas','cancelled') then raise exception 'INVALID_LOAN_STATUS'; end if;
  update public.dapin_loans set status=p_status,updated_at=now() where id=p_loan_id returning * into r;
  if r.id is null then raise exception 'LOAN_NOT_FOUND'; end if;
  return r;
end $$;
grant execute on function public.dapin_set_loan_status(uuid,text) to authenticated;

-- =========================================================
-- 7. Audit log coverage for DAPIN additions and changes
-- =========================================================
create or replace function public.dapin_audit_change()
returns trigger language plpgsql security definer set search_path=public
as $$
declare payload jsonb; entity uuid;
begin
  entity := coalesce(new.id,old.id);
  payload := jsonb_build_object(
    'table_name',TG_TABLE_NAME,
    'operation',TG_OP,
    'new',case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    'old',case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end
  );
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'DAPIN_'||TG_OP,TG_TABLE_NAME,entity,payload);
  return coalesce(new,old);
end $$;

drop trigger if exists dapin_member_documents_audit on public.dapin_member_documents;
create trigger dapin_member_documents_audit after insert or update or delete on public.dapin_member_documents for each row execute function public.dapin_audit_change();
drop trigger if exists dapin_collaterals_audit on public.dapin_collaterals;
create trigger dapin_collaterals_audit after insert or update or delete on public.dapin_collaterals for each row execute function public.dapin_audit_change();

alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_admin());
drop policy if exists security_events_admin_select on public.security_events;
create policy security_events_admin_select on public.security_events for select using (public.is_admin());
revoke insert,update,delete on public.audit_logs,public.security_events from authenticated;
grant select on public.audit_logs,public.security_events to authenticated;

commit;
