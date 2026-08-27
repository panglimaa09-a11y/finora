-- DAPIN MEMBER PROFILE
-- Scope: DAPIN only. FINORA Wallet/Core tables are untouched.

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

create or replace function public.set_dapin_member_profile_fields()
returns trigger language plpgsql as $$
begin
  if new.updated_at is null then new.updated_at := now(); end if;
  return new;
end $$;

drop trigger if exists dapin_collaterals_touch_updated_at on public.dapin_collaterals;
create trigger dapin_collaterals_touch_updated_at before update on public.dapin_collaterals
for each row execute function public.set_dapin_member_profile_fields();

-- Private Supabase Storage bucket for KTP, KK, profile photos and related documents.
insert into storage.buckets(id, name, public)
values ('dapin-documents', 'dapin-documents', false)
on conflict (id) do update set public=false;

-- Storage paths are scoped by DAPIN member UUID: <member_id>/<filename>
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
for insert with check (
  bucket_id='dapin-documents'
  and public.dapin_has_permission('dapin.members.manage')
  and split_part(name,'/',1) <> ''
  and split_part(name,'/',1)::uuid is not null
);

drop policy if exists dapin_documents_update on storage.objects;
create policy dapin_documents_update on storage.objects
for update using (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
) with check (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
);

drop policy if exists dapin_documents_delete on storage.objects;
create policy dapin_documents_delete on storage.objects
for delete using (
  bucket_id='dapin-documents' and public.dapin_has_permission('dapin.members.manage')
);

-- Keep profile changes auditable.
drop trigger if exists dapin_member_documents_audit on public.dapin_member_documents;
create trigger dapin_member_documents_audit after insert or update or delete on public.dapin_member_documents
for each row execute function public.audit_dapin_change();

drop trigger if exists dapin_collaterals_audit on public.dapin_collaterals;
create trigger dapin_collaterals_audit after insert or update or delete on public.dapin_collaterals
for each row execute function public.audit_dapin_change();
