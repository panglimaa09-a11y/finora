-- ============================================================
-- Fix: akun baru gagal mendaftar ("Database error saving new user")
-- Penyebab: trigger handle_new_user gagal INSERT ke tabel profiles
--           karena RLS memblokir INSERT untuk role authenticated,
--           dan trigger lama kemungkinan tidak SECURITY DEFINER.
--
-- Cara pakai: Supabase Dashboard → SQL Editor → paste semua → Run
-- Aman dijalankan berkali-kali (idempotent)
-- ============================================================

-- 1. Pastikan tabel profiles ada dengan kolom lengkap
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tambah kolom jika belum ada (aman jika sudah ada)
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- 2. Hapus trigger lama yang bermasalah
drop trigger if exists on_auth_user_created on auth.users;

-- 3. Hapus function lama
drop function if exists public.handle_new_user() cascade;

-- 4. Buat function yang benar
--    SECURITY DEFINER = jalan sebagai postgres (bypass RLS)
--    set search_path = '' = cegah serangan search_path
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.email, ''),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5. Pasang trigger baru
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Verifikasi: tampilkan trigger yang aktif di auth.users
--    Seharusnya hanya ada on_auth_user_created
select tgname as trigger_name,
       tgrelid::regclass as on_table,
       tgproc::regproc as calls_function
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal;
