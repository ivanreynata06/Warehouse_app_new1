# WH Dashboard — Frontend GitHub Pages + Apps Script Backend

Repo ini adalah hasil pemisahan dashboard kamu:

- **Frontend** (`index.html`, `kanban.html`, `rekap_muatan.html`, `monitoring_stock.html`)
  → di-hosting statis di **GitHub Pages**. Tidak ada lagi branding
  `script.google.com` / `googleusercontent.com`, karena halaman tidak
  lagi dibuka dari Apps Script.
- **Backend** (`backend/kode.gs`) → tetap di Google Apps Script, tapi
  **sekarang murni API JSON** (tidak lagi mengirim HTML). Frontend
  memanggilnya lewat `fetch`.

## Struktur folder

```
index.html               <- WH Control Tower (LANDING PAGE / menu utama saat buka link)
kanban.html               <- Dashboard Kanban PPR
rekap_muatan.html         <- Monitoring Tonase Persiapan
monitoring_stock.html     <- Dashboard Pipa & Fitting PPR (Monitoring Stock, Inbound & Outbound)
residance_time.html       <- Loading Time Pengiriman
assets/js/config.js        <- ISI URL WEB APP APPS SCRIPT DI SINI
assets/js/api-shim.js      <- pengganti google.script.run, tidak perlu diubah
assets/js/sw-register.js   <- pembersih Service Worker lama, tidak perlu diubah
backend/kode.gs             <- kode Apps Script (backend), paste ke Apps Script editor
```

> **Catatan:** `index.html` sekarang berisi **WH Control Tower** (bukan
> lagi Monitoring Stock), supaya saat orang buka
> `https://ivanreynata06.github.io/Warehouse_app_new1/` langsung
> masuk ke Control Tower. Halaman Monitoring Stock yang dulu ada di
> `index.html` sekarang pindah nama jadi `monitoring_stock.html`
> (isinya sama persis, cuma nama file & posisinya yang berubah).

## Langkah deploy

### 1. Deploy ulang Apps Script sebagai Web App (backend saja)

1. Buka project Apps Script kamu, **ganti isi `kode.gs` dengan isi
   `backend/kode.gs`** di repo ini (`doGet`/`doPost` sudah diganti
   jadi dispatcher JSON, fungsi-fungsi lain — `getDashboardData`,
   `getKanbanData`, dll — tidak diubah sama sekali).
2. **Deploy → New deployment**.
3. Type: **Web app**.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Deploy, lalu copy URL yang berakhiran `/exec`.

> Kalau sebelumnya kamu sudah pernah deploy, gunakan **Manage
> deployments → Edit (pensil) → New version** supaya URL `/exec` yang
> lama tetap sama (tidak perlu update `config.js` lagi tiap deploy).

### 2. Isi URL backend di frontend

Buka `assets/js/config.js`, ganti baris:

```js
window.APPS_SCRIPT_URL = 'PASTE_URL_WEB_APP_APPS_SCRIPT_DI_SINI/exec';
```

dengan URL `/exec` dari langkah 1.

### 3. Push ke GitHub & aktifkan GitHub Pages

```bash
git init
git add .
git commit -m "Dashboard WH: frontend GitHub Pages + backend Apps Script API"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Lalu di GitHub: **Settings → Pages → Source: Deploy from a branch →
Branch: `main` / folder `/ (root)` → Save**.

Situs akan aktif di `https://USERNAME.github.io/NAMA-REPO/`.

Buka `index.html` lewat URL itu (bukan `file://`), supaya `fetch()`
bisa jalan normal.

Setiap kali pindah menu (`navTo()`/`goTo()`), URL tujuan otomatis
ditambah `?_=<timestamp>` — ini memaksa browser selalu mengambil HTML
halaman tujuan yang terbaru dari GitHub, bukan versi lama yang
mungkin masih tersimpan di cache. Jadi pindah menu dijamin selalu
dapat versi terbaru, tanpa perlu hard refresh.

## Supabase (percepat loading dashboard harian)

Repo ini terhubung ke Supabase untuk mempercepat loading 4 halaman
(Control Tower, Monitoring Stock, Monitoring Kanban, Rekap Muatan).
Loading Time TIDAK ikut — datanya real-time, tetap langsung ke Apps
Script.

**Cara kerja:**
1. Sekali sehari, Apps Script (`syncAllToSupabase`, dijadwalkan via
   `setupDailySyncTrigger`) menghitung data pakai fungsi yang sudah
   ada (`getDashboardData`, `getKanbanData`, dst — TIDAK ditulis
   ulang), lalu menyimpan hasilnya ke tabel `dashboard_snapshots` di
   Supabase.
2. Browser baca dari Supabase dulu (`assets/js/supabase-cache.js`) —
   nyaris instan. Kalau kombinasi filter yang diminta belum
   di-precompute (mis. bulan yang jarang dilihat, atau filter grup
   spesifik), otomatis fallback ke Apps Script seperti biasa — tidak
   ada fitur yang hilang.

**File terkait:**
- `supabase/schema.sql` — jalankan sekali di Supabase SQL Editor
  untuk membuat tabel `dashboard_snapshots` + RLS policy.
- `backend/kode.gs` — fungsi `syncAllToSupabase()` (dipanggil
  otomatis 1x/hari) dan `setupDailySyncTrigger()` (jalankan MANUAL
  1x saja untuk memasang jadwalnya).
- `assets/js/config.js` — `SUPABASE_URL` & `SUPABASE_ANON_KEY`
  (aman publik, dilindungi RLS read-only).
- `assets/js/supabase-cache.js` — logika pencocokan & pengambilan
  snapshot, dipakai otomatis oleh `api-shim.js`.

**Setup di Apps Script** (Script Properties, BUKAN di kode/GitHub):
- `SUPABASE_URL` = `https://lfplllzsvpbgzcftcgmi.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role key (rahasia, dari Supabase
  Settings → API — beda dari anon key yang ada di `config.js`)

## Kenapa refresh data kadang lama?

Setiap kali dashboard di-refresh, beberapa fungsi backend dipanggil
BERSAMAAN (mis. `wh_control_tower.html` manggil 6-7 fungsi sekaligus:
stock, outbound, inbound, kanban, kanban-trend, rekap, loading-time).
Tiap panggilan ke Apps Script memang bawaannya butuh waktu (baca
spreadsheet), dan browser juga membatasi jumlah koneksi bersamaan ke
domain yang sama — jadi kalau banyak dipanggil sekaligus, sebagian
harus antre.

Untuk mengurangi ini, `backend/kode.gs` sekarang punya **cache di
sisi server** (`CacheService`) untuk semua fungsi baca data
(`getDashboardData`, `getKanbanData`, `getRekapMuatanData`, dst):
- Panggilan pertama tetap baca langsung dari spreadsheet (tidak bisa
  dihindari, itu yang lama).
- Panggilan berikutnya dengan parameter sama, dalam **90 detik**
  (untuk `getPendingRows`/`getResidenceTimeData` cuma **15 detik**,
  karena datanya dipakai di alur ubah status pengiriman — supaya
  tidak nyangkut basi lama setelah user update status), langsung
  dijawab dari cache server — nyaris instan, walau dipanggil dari
  Refresh berkali-kali atau dari banyak orang/tab sekaligus.

Kalau mau ubah lama cache-nya, atur `CACHE_TTL_DEFAULT` /
`CACHE_TTL_OVERRIDE` di bagian atas `backend/kode.gs`, lalu deploy
ulang seperti biasa.

## Kenapa kadang harus hard refresh sebelum ini?

GitHub Pages nge-*cache* file JS di browser pengunjung (cache HTTP
biasa, bukan Service Worker — itu sudah dihapus). Supaya update ke
`assets/js/config.js` / `api-shim.js` / `sw-register.js` **langsung**
kepakai tanpa perlu siapa pun hard refresh manual, tiap `<script src="...">`
ke 3 file itu (di 5 halaman HTML) diberi query version, contoh:

```html
<script src="./assets/js/api-shim.js?v=20260718c"></script>
```

**Setiap kali kamu (atau saya) mengubah isi salah satu dari 3 file
itu, naikkan angka `v=...` di SEMUA 5 file HTML** (cari-ganti biasa),
supaya browser pengunjung otomatis mengambil versi baru — bukan
versi lama yang nyangkut di cache mereka.

## Kenapa navigasi menu sekarang tidak lagi ke situs Apps Script?

Sebelumnya tombol menu (`navTo('kanban')`, dst.) selalu redirect ke
URL Apps Script (`...script.google.com/...?page=kanban`). Sekarang
`navTo()` di semua halaman diganti supaya pindah ke **file statis di
repo GitHub yang sama** (`kanban.html`, `rekap_muatan.html`, dst.),
jadi pengguna tidak pernah lagi diarahkan keluar ke domain Apps
Script — Apps Script murni jadi backend data.

## Cache

Awalnya repo ini pakai Service Worker (`sw.js`) untuk cache file
statis. **Sudah dihapus** — ternyata browser cuma mau cek versi baru
Service Worker maksimal 1x/24 jam kecuali DevTools dibuka, jadi
dashboard bisa "nyangkut" di versi lama sampai satu hari untuk siapa
pun yang sudah pernah buka situsnya. `assets/js/sw-register.js`
sekarang isinya kebalikannya: otomatis **unregister** Service Worker
+ hapus cache lama dari browser siapa pun yang sempat ke-install,
sekali jalan, permanen bersih — tidak perlu F12 manual lagi. GitHub
Pages sendiri sudah cukup cepat lewat HTTP cache browser biasa.

Cache yang **masih dipakai** cuma satu lapis:

- **Cache data API (`api-shim.js`)** — hasil tiap panggilan
  `getDashboardData`, `getKanbanData`, dll disimpan di
  `sessionStorage` selama `APPS_CACHE_TTL_MS` (default 3 menit,
  diatur di `config.js`). Saat pindah menu / reload, data lama
  langsung tampil (cepat), lalu otomatis di-update diam-diam kalau
  sudah lewat TTL. Tombol **Refresh** di tiap halaman sudah
  dipasangi `clearApiCache()` supaya selalu ambil data terbaru saat
  diklik manual. Cache ini aman — `sessionStorage` otomatis kosong
  lagi setiap tab ditutup, tidak akan pernah "nyangkut" permanen.

## Catatan penting

- **`residance_time.html` sudah lengkap** (menu "Loading Time Pengiriman"),
  termasuk fungsi backend `setStatusTerkirim` yang sebelumnya belum ada
  di `backend/kode.gs` — sudah ditambahkan mengikuti pola
  `setStatusPending`/`setStatusBatal` yang sudah ada.
- **CORS `savePhoto`**: fungsi ini dikirim lewat `POST` dengan
  `Content-Type: text/plain` (bukan `application/json`) supaya
  browser tidak mengirim *preflight* `OPTIONS` — Apps Script Web App
  memang tidak bisa menjawab preflight CORS. Ini trik standar, jangan
  diubah ke `application/json` atau `savePhoto` akan gagal karena
  diblokir CORS.
- **Keamanan API**: `backend/kode.gs` memakai whitelist
  (`API_FUNCTIONS`) — hanya fungsi yang didaftarkan di situ yang bisa
  dipanggil lewat URL `?action=...`. Kalau nanti menambah fungsi baru
  di backend yang perlu dipanggil dari frontend, jangan lupa
  tambahkan juga ke daftar `API_FUNCTIONS`.
- Karena `Who has access: Anyone` pada Web App, siapa pun yang tahu
  URL `/exec` bisa memanggil endpoint ini (sama seperti behaviour
  Apps Script Web App biasa). Kalau datanya sensitif, pertimbangkan
  tambah token rahasia sederhana (cek `params.token` di
  `handleApiRequest`) yang juga dikirim dari `api-shim.js`.
