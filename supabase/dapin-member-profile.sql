-- DAPIN MEMBER PROFILE
-- DAPIN only. FINORA Wallet/Core is untouched.

alter table public.dapin_members add column if not exists nik text;
alter table public.dapin_members add column if not exists kk_number text;
alter table public.dapin_members add column if not exists birth_place text;
alter table public.dapin_members add column if not exists birth_date date;
alter table public.dapin_members add column if not exists gender text check (gender is null or gender in ('L','P'));
alter table public.dapin_members add column if not exists occupation text;
alter table public.dapin_members add column if not exists marital_status text;

create index if not exists idx_dapin_members_nik on public.dapin_members(nik) where nik is not null;
create index if not exists idx_dapin_members_kk on public.dapin_members(kk_number) where kk_number is not null;

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

drop policy if exists dapin_member_documents_admin on public.dapin_member_documents;
create policy dapin_member_documents_admin on public.dapin_member_documents
for all using (public.dapin_has_permission('dapin.members.manage'))
with check (public.dapin_has_permission('dapin.members.manage'));

drop policy if exists dapin_collaterals_select on public.dapin_collaterals;
create policy dapin_collaterals_select on public.dapin_collaterals
for select using (
  public.dapin_has_permission('dapin.read.all')
  or exists (select 1 from public.dapin_members m where m.id=member_id and m.user_id=auth.uid())
);

drop policy if exists dapin_collaterals_admin on public.dapin_collaterals;
create policy dapin_collaterals_admin on public.dapin_collaterals
for all using (public.dapin_has_permission('dapin.members.manage'))
with check (public.dapin_has_permission('dapin.members.manage'));

grant select on public.dapin_member_documents, public.dapin_collaterals to authenticated;
grant insert, update, delete on public.dapin_member_documents, public.dapin_collaterals to authenticated;

create or replace function public.dapin_update_member_profile(
  p_member_id uuid,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_nik text default null,
  p_kk_number text default null,
  p_birth_place text default null,
  p_birth_date date default null,
  p_gender text default null,
  p_occupation text default null,
  p_marital_status text default null,
  p_status text default null
) returns public.dapin_members
language plpgsql security definer set search_path=public
as $$
declare r public.dapin_members;
begin
  if not public.dapin_has_permission('dapin.members.manage') then raise exception 'DAPIN_PERMISSION_DENIED'; end if;
  if p_gender is not null and p_gender not in ('L','P') then raise exception 'INVALID_GENDER'; end if;
  if p_status is not null and p_status not in ('active','inactive','suspended') then raise exception 'INVALID_MEMBER_STATUS'; end if;
  update public.dapin_members
  set name=coalesce(nullif(btrim(p_name),''),name),
      email=coalesce(nullif(btrim(p_email),''),email),
      phone=coalesce(nullif(btrim(p_phone),''),phone),
      address=coalesce(nullif(btrim(p_address),''),address),
      nik=coalesce(nullif(btrim(p_nik),''),nik),
      kk_number=coalesce(nullif(btrim(p_kk_number),''),kk_number),
      birth_place=coalesce(nullif(btrim(p_birth_place),''),birth_place),
      birth_date=coalesce(p_birth_date,birth_date),
      gender=coalesce(p_gender,gender),
      occupation=coalesce(nullif(btrim(p_occupation),''),occupation),
      marital_status=coalesce(nullif(btrim(p_marital_status),''),marital_status),
      status=coalesce(p_status,status),
      updated_at=now()
  where id=p_member_id
  returning * into r;
  if r.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  return r;
end $$;

grant execute on function public.dapin_update_member_profile(uuid,text,text,text,text,text,text,text,date,text,text,text,text) to authenticated;

insert into storage.buckets(id,name,public)
values ('dapin-documents','dapin-documents',false)
on conflict (id) do update set public=false;

drop policy if exists dapin_documents_read on storage.objects;
create policy dapin_documents_read on storage.objects
for select using (
  bucket_id='dapin-documents'
  and (
    public.dapin_has_permission('dapin.read.all')
    or exists (
      select 1 from public.dapin_members m
      where m.id = nullif(split_part(name,'/',1),'')::uuid
        and m.user_id = auth.uid()
    )
  )
);

drop policy if exists dapin_documents_write on storage.objects;
create policy dapin_documents_write on storage.objects
for insert with check (bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage'));

drop policy if exists dapin_documents_update on storage.objects;
create policy dapin_documents_update on storage.objects
for update using (bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage'))
with check (bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage'));

drop policy if exists dapin_documents_delete on storage.objects;
create policy dapin_documents_delete on storage.objects
for delete using (bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage'));
