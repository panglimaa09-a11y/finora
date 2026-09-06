-- =====================================================================
-- Security hardening: menjawab laporan Database Linter
--
-- 1) Function Search Path Mutable (lint 0011)
-- 2) anon / authenticated bisa jalankan SECURITY DEFINER (lint 0028/0029)
--
-- Catatan penting:
--  - is_admin, is_dapin_admin, dapin_has_permission, dapin_current_role
--    TIDAK di-revoke karena dipakai di policy RLS.
--  - Fungsi DAPIN sudah punya cek izin internal (dapin_has_permission ->
--    DAPIN_PERMISSION_DENIED), sehingga aman untuk dijalankan oleh user
--    yang sudah login.
--  - handle_new_user/handle_new_profile/touch_updated_at/set_updated_at
--    dll adalah "returns trigger": TIDAK bisa dipanggil lewat /rest/v1/rpc,
--    hanya pemicu. Aman.
--
-- Idempotent: aman dijalankan berulang kali.
-- Cara pakai: Supabase Dashboard -> SQL Editor -> tempel semua -> Run
-- =====================================================================

-- 1) Kunci search_path untuk fungsi yang belum terkunci (lint 0011)
do $$
declare r record;
begin
  for r in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'generate_member_number',
        'generate_loan_reference',
        'validate_loan_calculation',
        'touch_updated_at',
        'dapin_assign_ids'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      r.nspname, r.proname,
      pg_get_function_identity_arguments(r.oid)
    );
  end loop;
end $$;

-- 2) Blokir TOTAL (anon MAUPUN authenticated TIDAK boleh memanggil).
--    Catatan: grant default fungsi PostgreSQL adalah PUBLIC, jadi revoke
--    dari "public" (bukan sekadar anon/authenticated) agar efektif.
--    Daftar ini: fungsi uang/admin yang TIDAK dipakai front-end.
--    - post_topup TIDAK memeriksa auth.uid() (bisa membebani topup orang lain)
--    - ensure_wallet / create_withdrawal / admin_* belum digunakan aplikasi
--    Kalau nanti panel admin membutuhkannya, tinggal GRANT EXECUTE lagi.
do $$
declare r record;
begin
  for r in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_approve_loan',
        'admin_reject_loan',
        'admin_set_credit_profile',
        'admin_start_loan_review',
        'dapin_set_user_role',
        'dapin_sync_auth_role',
        'set_dapin_member_identity',
        'create_dapin_member',
        'calculate_loan',
        'validate_member_loan',
        'ensure_wallet',
        'post_topup',
        'create_withdrawal'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public',
      r.nspname, r.proname,
      pg_get_function_identity_arguments(r.oid)
    );
  end loop;
end $$;

-- 3) Fungsi yang DIPANGGIL aplikasi saat login (authenticated):
--    anon diblokir, authenticated tetap bisa.
--    (Masing-masing sudah punya cek izin internal dapin_has_permission,
--     sehingga aman dijalankan oleh user yang sudah login.)
do $$
declare r record;
begin
  for r in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'submit_dapin_loan',
        'dapin_create_member',
        'dapin_update_member_profile',
        'dapin_record_saving',
        'dapin_create_loan',
        'dapin_record_payment',
        'dapin_record_transaction',
        'dapin_set_member_status',
        'dapin_set_loan_status',
        'dapin_add_collateral',
        'dapin_add_member_document',
        'dapin_update_member_employment'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public',
      r.nspname, r.proname,
      pg_get_function_identity_arguments(r.oid)
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      r.nspname, r.proname,
      pg_get_function_identity_arguments(r.oid)
    );
  end loop;
end $$;

-- 4) Verifikasi: siapa yang masih bisa memanggil fungsi penting
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')            as anon_can_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')   as auth_can_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin','is_dapin_admin','dapin_has_permission','dapin_current_role',
    'post_topup','create_withdrawal','ensure_wallet','submit_dapin_loan'
  )
order by p.proname;