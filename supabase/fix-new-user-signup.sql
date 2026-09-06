-- =====================================================================
-- Fix: akun baru gagal mendaftar  ("Database error saving new user")
--
-- Penyebab umum:
--  1) Trigger AFTER INSERT di auth.users melempar error saat memuat
--     profil/wallet (mis. kolom NOT NULL tanpa default di public.profiles
--     dari template lama, mis. kolom username).
--  2) Skema utama (supabase.sql) memakai trigger
--     on_auth_user_created_wallet & on_auth_user_created_profile.
--     Versi fix sebelumnya menghapus function handle_new_user() cascade
--     sehingga trigger pembuat wallet ikut hilang.
--
-- Fix ini (idempotent, aman dijalankan ulang):
--  - Menjamin tabel public.profiles + kolom yang dibutuhkan
--  - Melonggarkan kolom template lama yang bisa menghalangi insert
--  - Membuang SEMUA trigger auth.users lama + function lamanya
--  - Memasang ulang 2 trigger yang benar:
--        handle_new_user()   -> buat wallet  (SECURITY DEFINER)
--        handle_new_profile()-> buat profile (SECURITY DEFINER)
--  - Backfill akun lama yang belum punya wallet/profile
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> paste semua -> Run
-- =====================================================================

-- 1) Pastikan tabel profiles ada + kolom lengkap
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Kolom template lama yang punya NOT NULL tanpa default (mis. username)
-- bisa membuat insert dari trigger gagal -> longgarkan bila ada
do $$
declare col_exists boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='username'
  ) into col_exists;
  if col_exists then
    alter table public.profiles alter column username drop not null;
  end if;
end $$;

-- 2) Buang semua trigger auth.users + function lama (cascade untuk
--    membersihkan trigger bernama lain yang masih menempel)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_wallet on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_new_profile() cascade;

-- 3) Function wallet: buat wallet saat user baru terdaftar
--    SECURITY DEFINER = jalan sebagai pemilik tabel (bypass RLS)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, wallet_code)
  values (new.id, 'FN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 4) Function profile: buat profile saat user baru terdaftar
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    ),
    coalesce(new.email, ''),
    case
      when lower(coalesce(new.email, '')) = 'panglimaa09@gmail.com' then 'super_admin'
      when lower(coalesce(new.email, '')) = 'deavani1705@gmail.com' then 'admin'
      else 'member'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5) Pasang ulang trigger
create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- 6) Backfill akun lama yang belum punya wallet / profile
insert into public.wallets (user_id, wallet_code)
select u.id, 'FN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
from auth.users u
left join public.wallets w on w.user_id = u.id
where w.id is null
on conflict (user_id) do nothing;

insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
  u.email,
  case
    when lower(u.email) = 'panglimaa09@gmail.com' then 'super_admin'
    when lower(u.email) = 'deavani1705@gmail.com' then 'admin'
    else 'member'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 7) Verifikasi: tampilkan trigger aktif di auth.users
--    Hasil akhir seharusnya persis 2 baris:
--      on_auth_user_created_wallet -> handle_new_user
--      on_auth_user_created_profile -> handle_new_profile
select tgname as trigger_name,
       tgproc::regproc as calls_function
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal
order by tgname;