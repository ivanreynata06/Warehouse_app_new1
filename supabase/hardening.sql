-- ============================================================
-- PENGETATAN KEAMANAN SUPABASE (opsional, aman dijalankan berulang)
-- Jalankan di Supabase > SQL Editor. TIDAK mengubah cara kerja aplikasi:
--   * dashboard tetap BACA lewat kunci anon (SELECT dashboard_snapshots)
--   * Apps Script tetap TULIS lewat service_role (bypass RLS)
-- Yang dilakukan: memastikan RLS aktif + mencabut hak tulis/hak lain dari anon & authenticated.
-- ============================================================
alter table public.dashboard_snapshots     enable row level security;
alter table public.storage_usage_history   enable row level security;

-- anon / authenticated: hanya boleh SELECT dashboard_snapshots (policy "Public read access")
revoke insert, update, delete, truncate, references, trigger on public.dashboard_snapshots from anon, authenticated;
revoke select on public.dashboard_snapshots from authenticated;

-- storage_usage_history & fungsi statistik: hanya service_role
revoke all on public.storage_usage_history from anon, authenticated;
revoke execute on function public.wh_storage_stats() from public, anon, authenticated;

-- Cek hasil: kedua tabel harus rowsecurity = true; policy anon hanya SELECT
select tablename, rowsecurity from pg_tables where schemaname = 'public';
select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';
