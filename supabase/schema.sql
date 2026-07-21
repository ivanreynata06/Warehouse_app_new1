-- ============================================================
-- SKEMA SUPABASE: "Snapshot Harian" untuk WH Dashboard
-- ------------------------------------------------------------
-- Cara pakai: buka Supabase -> SQL Editor -> New query ->
-- paste semua isi file ini -> Run.
--
-- Konsep: Apps Script tetap yang MENGHITUNG data (pakai fungsi
-- yang sudah ada & teruji: getDashboardData, getKanbanData, dst),
-- lalu SEKALI SEHARI hasilnya (JSON, persis sama seperti yang
-- sekarang dikirim ke browser) disimpan ke tabel ini. Dashboard
-- baca langsung dari sini -> jauh lebih cepat daripada nunggu
-- Apps Script hitung ulang tiap kali dibuka.
-- ============================================================

create table if not exists dashboard_snapshots (
  id           bigint generated always as identity primary key,
  snapshot_key text not null unique,
  payload      jsonb not null,
  updated_at   timestamptz not null default now()
);

-- Index buat lookup cepat by key (snapshot_key sudah UNIQUE jadi otomatis
-- ada index, tapi ditulis eksplisit di sini biar jelas)
create index if not exists idx_dashboard_snapshots_key on dashboard_snapshots (snapshot_key);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY: publik cuma boleh BACA (SELECT), tidak
-- boleh ubah apa pun. Yang boleh nulis/update cuma Apps Script,
-- lewat SERVICE ROLE key (bukan anon key) yang tidak pernah
-- disimpan di frontend/GitHub — itu tetap aman walau tabel ini
-- bisa dibaca siapa saja.
-- ------------------------------------------------------------
alter table dashboard_snapshots enable row level security;

drop policy if exists "Public read access" on dashboard_snapshots;
create policy "Public read access"
  on dashboard_snapshots
  for select
  to anon
  using (true);

-- Sengaja TIDAK ada policy insert/update/delete untuk role anon,
-- jadi otomatis diblokir oleh RLS. Apps Script pakai service_role
-- key yang otomatis bypass RLS (itu memang perannya service_role).

-- ------------------------------------------------------------
-- Cek hasil: harusnya muncul tabel kosong (belum ada baris,
-- baru akan terisi setelah Apps Script pertama kali sinkron)
-- ------------------------------------------------------------
select * from dashboard_snapshots;
