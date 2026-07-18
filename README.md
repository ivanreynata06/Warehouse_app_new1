# WH Dashboard — Frontend GitHub Pages + Apps Script Backend

Repo ini adalah hasil pemisahan dashboard kamu:

- **Frontend** (`index.html`, `kanban.html`, `rekap_muatan.html`, `wh_control_tower.html`)
  → di-hosting statis di **GitHub Pages**. Tidak ada lagi branding
  `script.google.com` / `googleusercontent.com`, karena halaman tidak
  lagi dibuka dari Apps Script.
- **Backend** (`backend/kode.gs`) → tetap di Google Apps Script, tapi
  **sekarang murni API JSON** (tidak lagi mengirim HTML). Frontend
  memanggilnya lewat `fetch`.

## Struktur folder

```
index.html               <- Dashboard Pipa & Fitting PPR (menu utama)
kanban.html               <- Dashboard Kanban PPR
rekap_muatan.html         <- Monitoring Tonase Persiapan
wh_control_tower.html     <- WH Control Tower
residance_time.html       <- placeholder (lihat catatan di bawah)
sw.js                      <- Service Worker (cache asset statis)
assets/js/config.js        <- ISI URL WEB APP APPS SCRIPT DI SINI
assets/js/api-shim.js      <- pengganti google.script.run, tidak perlu diubah
assets/js/sw-register.js   <- daftar service worker, tidak perlu diubah
backend/kode.gs             <- kode Apps Script (backend), paste ke Apps Script editor
```

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
dan Service Worker bisa jalan normal.

## Kenapa navigasi menu sekarang tidak lagi ke situs Apps Script?

Sebelumnya tombol menu (`navTo('kanban')`, dst.) selalu redirect ke
URL Apps Script (`...script.google.com/...?page=kanban`). Sekarang
`navTo()` di semua halaman diganti supaya pindah ke **file statis di
repo GitHub yang sama** (`kanban.html`, `rekap_muatan.html`, dst.),
jadi pengguna tidak pernah lagi diarahkan keluar ke domain Apps
Script — Apps Script murni jadi backend data.

## Cache — supaya loading di GitHub Pages cepat

Ada 2 lapis cache:

1. **Service Worker (`sw.js`)** — meng-cache file statis (HTML/JS)
   di browser, supaya kunjungan berikutnya loading instan walau
   koneksi lambat. Request ke Apps Script **tidak** disentuh SW ini.
   ⚠️ Setiap kali kamu update isi file di repo, naikkan versi
   `CACHE_NAME` di `sw.js` (`v1` → `v2`), supaya browser pengguna
   mengambil versi baru, bukan versi cache lama.
2. **Cache data API (`api-shim.js`)** — hasil tiap panggilan
   `getDashboardData`, `getKanbanData`, dll disimpan di
   `sessionStorage` selama `APPS_CACHE_TTL_MS` (default 3 menit,
   diatur di `config.js`). Saat pindah menu / reload, data lama
   langsung tampil (cepat), lalu otomatis di-update diam-diam kalau
   sudah lewat TTL. Tombol **Refresh** di tiap halaman sudah
   dipasangi `clearApiCache()` supaya selalu ambil data terbaru saat
   diklik manual.

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
