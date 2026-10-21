-- ============================================================
-- MONITORING PENYIMPANAN SUPABASE (menu Kelola User -> "Penyimpanan Supabase")
-- ------------------------------------------------------------
-- Cara pakai: Supabase -> SQL Editor -> New query -> paste semua isi
-- file ini -> Run. Aman dijalankan berulang kali.
--
-- Yang dibuat:
--   1) tabel  storage_usage_history : 1 baris per hari (ukuran database) -> dasar estimasi pertumbuhan
--   2) fungsi wh_storage_stats()    : ukuran database, ukuran tabel, dan ringkasan snapshot per
--                                     departemen / jenis data. Sekaligus mencatat titik hari ini.
--
-- Keamanan: fungsi hanya boleh dipanggil oleh service_role (dipakai Apps Script lewat
-- SUPABASE_SERVICE_KEY). anon / authenticated DIBLOKIR, jadi tidak bisa dibuka dari browser.
-- ============================================================

create table if not exists public.storage_usage_history (
  day           date primary key,
  db_bytes      bigint not null,   -- pg_database_size (sama dengan "Database size" di dashboard Supabase)
  app_bytes     bigint not null,   -- total tabel schema public (data + index + TOAST)
  snapshot_rows bigint not null default 0,
  recorded_at   timestamptz not null default now()
);

alter table public.storage_usage_history enable row level security;
-- Sengaja TANPA policy utk anon/authenticated -> otomatis tertutup. service_role bypass RLS.
grant select, insert, update, delete on public.storage_usage_history to service_role;

create or replace function public.wh_storage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_db     bigint := pg_database_size(current_database());
  v_app    bigint;
  v_rows   bigint;
  v_tables jsonb;
  v_groups jsonb;
  v_hist   jsonb;
begin
  select coalesce(sum(pg_total_relation_size(c.oid)), 0) into v_app
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'm');

  select count(*) into v_rows from public.dashboard_snapshots;

  -- catat titik hari ini (1 baris/hari, ditimpa kalau dipanggil lagi di hari yang sama)
  insert into public.storage_usage_history (day, db_bytes, app_bytes, snapshot_rows)
  values (current_date, v_db, v_app, v_rows)
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, app_bytes = excluded.app_bytes,
        snapshot_rows = excluded.snapshot_rows, recorded_at = now();

  -- ukuran per tabel (schema public)
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', c.relname,
           'total_bytes', pg_total_relation_size(c.oid),
           'table_bytes', pg_relation_size(c.oid),
           'index_bytes', pg_indexes_size(c.oid),
           'rows', case when c.relname = 'dashboard_snapshots' then v_rows else greatest(c.reltuples, 0)::bigint end
         ) order by pg_total_relation_size(c.oid) desc), '[]'::jsonb)
  into v_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  -- ringkasan snapshot: key berformat  <departemen>::<jenis>:<mode>:<periode>
  with p as (
    select snapshot_key,
           pg_column_size(payload)::bigint as bytes,
           updated_at,
           case when snapshot_key like '%::%' then split_part(snapshot_key, '::', 1) else '(umum)' end as ws,
           case when snapshot_key like '%::%' then substr(snapshot_key, position('::' in snapshot_key) + 2) else snapshot_key end as rest
    from public.dashboard_snapshots
  ), q as (
    select *, split_part(rest, ':', 1) as typ, split_part(rest, ':', 2) as mode, split_part(rest, ':', 3) as period from p
  ), g as (
    select ws, typ, mode,
           case when period ~ '^\d{4}-\d{2}-\d{2}$' then 'daily'
                when period ~ '^\d{4}-\d{2}$'       then 'monthly'
                else 'static' end as pattern,
           count(*)               as keys,
           sum(bytes)             as bytes,
           round(avg(bytes))      as avg_bytes,
           min(period)            as first_period,
           max(period)            as last_period,
           max(updated_at)        as updated_at
    from q group by ws, typ, mode, 4
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ws', ws, 'type', typ, 'mode', mode, 'pattern', pattern, 'keys', keys, 'bytes', bytes,
           'avg_bytes', avg_bytes, 'first_period', first_period, 'last_period', last_period, 'updated_at', updated_at
         ) order by bytes desc), '[]'::jsonb)
  into v_groups from g;

  -- riwayat harian (180 hari terakhir)
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', day, 'db_bytes', db_bytes, 'app_bytes', app_bytes, 'rows', snapshot_rows
         ) order by day), '[]'::jsonb)
  into v_hist
  from (select * from public.storage_usage_history order by day desc limit 180) h;

  return jsonb_build_object(
    'db_bytes', v_db, 'app_bytes', v_app, 'snapshot_rows', v_rows,
    'tables', v_tables, 'groups', v_groups, 'history', v_hist,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.wh_storage_stats() from public, anon, authenticated;
grant execute on function public.wh_storage_stats() to service_role;

-- Cek hasil (jalankan sebagai postgres di SQL Editor):
-- select jsonb_pretty(public.wh_storage_stats());
