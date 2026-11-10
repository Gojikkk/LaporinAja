# LaporinAja

**LaporinAja** adalah website pelaporan masalah fasilitas publik (jalan berlubang, lampu mati, sampah menumpuk, saluran air tersumbat) yang menekankan transparansi tindak lanjut. Folder ini berisi aplikasi frontend React; backend Express dan panduan menjalankan seluruh aplikasi ada di [README utama](../README.md).

> ⚠️ Prototype kompetisi. Tidak ada integrasi dengan pemerintah atau instansi resmi.

---

## Tech Stack

| Lapisan | Teknologi |
|---------|-----------|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | CSS responsif kustom (tanpa UI library) |
| Routing | React Router v6 (BrowserRouter) |
| HTTP Client | Fetch API (`credentials: "include"`, CSRF-aware) |
| State/Data | API backend via `fetch` + typed endpoint wrapper |
| Lingkungan | Node.js 20+ |

---

## Cara Menjalankan

### Prasyarat
- Node.js 20 atau lebih baru
- npm

### Clone → Install → Run

```sh
# Clone repository gabungan terlebih dahulu, lalu jalankan dari root:
# git clone https://github.com/Gojikkk/backend-LaporinAja.git
# cd backend-LaporinAja
cd frontend

# Install dependencies
npm install

# Salin file env dan sesuaikan
cp .env.example .env.local

# Jalankan dev server
npm run dev
```

Vite membuka frontend pada `http://localhost:5173`.

Untuk build produksi: `npm run build` → hasil di folder `dist/`.

### Jalankan tes end-to-end

Dari folder `frontend/`, instal dependensi dan browser Chromium sekali, lalu jalankan Playwright:

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

Tes E2E mencakup alur utama pelapor dan admin, statistik publik dan admin, serta pemeriksaan aksesibilitas dengan axe.

---

## QA otomatis dengan Playwright

Tes browser ini memeriksa beranda dan navigasi, pencarian/filter serta detail laporan publik, statistik, halaman sistem 403/404, login/registrasi, dan perlindungan rute. Dengan kredensial admin, suite juga memeriksa statistik admin dan ekspor CSV. Tes yang mengubah data (membuat akun/laporan, mengubah status, notifikasi, atau kategori) hanya berjalan jika diaktifkan secara eksplisit.

### Persiapan

1. Jalankan backend, database, dan frontend seperti petunjuk di [README utama](../README.md). Untuk preview Cloudflare, jalankan `Start-Staging.bat` dan biarkan terminalnya tetap hidup.
2. Dari folder `frontend`, install dependency dan browser Chromium satu kali:

   ```sh
   npm install
   npx playwright install chromium
   ```

3. Di terminal yang akan dipakai untuk tes, atur URL aplikasi yang sedang berjalan. Untuk lokal gunakan `http://127.0.0.1:5173`; untuk preview gunakan URL `https://...trycloudflare.com` yang ditampilkan launcher:

   ```powershell
   $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:5173"
   ```

### Jalankan tes

```sh
npm run test:e2e
```

Tes dibuka di Chromium, dijalankan satu per satu, dan hasil HTML disimpan di `frontend/playwright-report/`. Buka laporan terakhir dengan `npm run test:e2e:report`. Untuk menjalankan browser test secara interaktif gunakan `npm run test:e2e:ui`.

### Tes alur lengkap (mengubah data)

Jalankan hanya pada database lokal/staging khusus QA—jangan pada production. Tes ini membuat akun, laporan beserta foto, meninjau dan menyelesaikan laporan dengan admin, serta menambahkan/mengubah/menonaktifkan kategori. Data hasil tes disimpan pada database.

```powershell
$env:PLAYWRIGHT_RUN_MUTATING = "1"
$env:PLAYWRIGHT_ADMIN_EMAIL = "email-admin-staging"
$env:PLAYWRIGHT_ADMIN_PASSWORD = "password-admin-staging"
npm run test:e2e
```

Gunakan kredensial admin yang ditampilkan oleh `Start-Staging.bat` atau akun admin khusus QA. Password admin dari launcher juga disimpan di `%LOCALAPPDATA%\LaporinAja\staging-admin-password.txt`. Jangan masukkan password ke file konfigurasi atau commit. Tes pembuatan laporan memerlukan kategori aktif dan konfigurasi upload gambar backend yang berfungsi. Hilangkan `$env:PLAYWRIGHT_RUN_MUTATING` untuk kembali menjalankan tes aman tanpa perubahan data.

---

## Progress Saat Ini

Frontend menyediakan UI untuk halaman dan alur berikut:

| Area | Status | Keterangan |
|------|--------|------------|
| Landing page | ✅ | Hero, kategori, statistik, CTA |
| Registrasi & Login | ✅ | Form validasi + error handling |
| Pembuatan laporan | ✅ | Form multipart dengan upload foto |
| Daftar laporan publik | ✅ | Filter kategori, status, wilayah |
| Detail laporan publik | ✅ | Riwayat status + bukti tindak lanjut |
| Dashboard pelapor | ✅ | Sidebar pelapor, 6 kartu status, state kosong/error |
| Laporan Saya (pelapor) | ✅ | Daftar lengkap + filter status/kategori + pagination |
| Pelacakan laporan saya | ✅ | Detail per status: bukti selesai, referensi duplikat, alasan penolakan |
| Dashboard admin | ✅ | Antrean laporan, aksi verifikasi/tolak |
| Manajemen kategori admin | ✅ | CRUD kategori (FR-023 / Should Have) |
| Halaman statistik | ✅ | Statistik dasar laporan |
| Halaman sistem (403 / 404) | ✅ | |
| Responsif (mobile–desktop) | ✅ | Breakpoint 360px – 1400px |

Data daftar/detail laporan, dashboard pelapor, dan ruang admin dimuat langsung dari API backend. `src/shared/report-store.ts` hanya memetakan DTO API ke view model dan menyimpan helper tampilan.

---

## Struktur frontend

```text
src/
  app/App.tsx                  route table and page composition
  components/ui.tsx            shared navigation, buttons, badges, cards, timeline, dialog, toast
  features/
    public/pages.tsx            landing, reports, detail, statistics, about, privacy
    auth/pages.tsx              login and registration
    reporter/pages.tsx          reporter dashboard, Laporan Saya list, report form, private tracking
    reporter/shell.tsx          reporter workspace navigation and page title (LAP-22)
    admin/pages.tsx             admin dashboard, report queue, report review
    admin/categories.tsx        admin report category management (LAP-30)
    admin/shell.tsx             admin workspace navigation and page title
    admin/data.ts               shared store re-export for admin screens
    system/pages.tsx            403 and 404 views
    */index.ts                  feature exports
  shared/
    api/client.ts               REST client, credentials, CSRF, normalized errors
    report-data.ts              status/category types and public card shape
    report-store.ts             demo report store shared by admin, public, reporter
  styles/global.css             responsive global design system
  styles/admin.css              admin workspace (LAP-23/LAP-30 theme, .adm)
  styles/reporter.css           reporter workspace (LAP-22 theme, .rep)
  styles/theme.css              shared LAP-23 theme for public/reporter (.app-theme)
  styles/home.css               Beranda layout (hero, kategori, statistik, penutup)
  main.tsx                      React entry point and BrowserRouter
  vite-env.d.ts                 Vite environment types
```

Routing, komponen bersama, mapper data API, dan layar peran berada di modul terpisah agar perubahan tiap bagian lebih mudah ditelusuri.

## URL API per environment

Salin `.env.example` menjadi `.env.local` untuk lokal. URL default API lokal adalah `http://localhost:3000/api`, sesuai port backend pada repository ini. Ubah `VITE_API_URL` bila backend berjalan di alamat lain. Contoh deployment:

```dotenv
VITE_API_URL=https://api.example.test/api
VITE_CSRF_COOKIE_NAME=laporinaja_csrf
VITE_CSRF_HEADER_NAME=X-CSRF-Token
# Alternative to a shared-domain readable CSRF cookie:
VITE_CSRF_ENDPOINT=/auth/csrf
```

Vite membaca nilai `VITE_*` saat build. Atur URL sesuai environment dan bangun ulang aplikasi untuk setiap deployment.

## Kontrak integrasi browser/API

- Semua request menggunakan `credentials: "include"`; sesi harus berupa cookie `HttpOnly`, `Secure` di HTTPS, dengan kebijakan `SameSite` dan domain yang sesuai topologi deployment.
- Frontend tidak menyimpan token sesi di `localStorage` atau `sessionStorage`. Cookie CSRF opsional boleh dibaca jika server memang menerbitkannya; nama cookie dan header dapat dikonfigurasi. Jangan isi variabel CSRF dengan nama cookie sesi.
- Browser mengirim `Origin` secara otomatis. Server Express perlu mengizinkan origin frontend secara eksplisit, mengaktifkan CORS `credentials: true`, menjawab preflight, dan memeriksa `Origin` untuk operasi mutasi. Jika server memakai token CSRF, terbitkan cookie CSRF yang dapat dibaca JavaScript dan set nama cookie/header di environment frontend.
- Untuk deployment lintas-site yang tidak dapat membaca cookie CSRF API, set `VITE_CSRF_ENDPOINT` ke endpoint yang mengembalikan token CSRF di `{ "data": { "csrfToken": "..." } }`; token hanya ditahan di memori selama halaman terbuka.
- API mengembalikan error konsisten `{ "error": { "code", "message", "fields" } }`. Klien memetakannya ke `ApiError`; kegagalan jaringan menampilkan pesan umum bahasa Indonesia.
- Seluruh halaman memakai endpoint backend: auth (`/auth/*`), kategori publik & admin, laporan publik/pelapor/admin, tindak lanjut dan perubahan status admin, statistik, notifikasi, serta ekspor CSV. Detail kontrak ada di `src/shared/api/endpoints.ts` dan `src/shared/api/types.ts`.

## Rute utama

Publik: `/`, `/laporan`, `/laporan/:code`, `/statistik`, `/tentang`, `/kebijakan-privasi`, `/masuk`, `/daftar`.

Pelapor: `/dashboard`, `/dashboard/laporan`, `/dashboard/laporan/:code`, `/lapor/baru`.

Administrator platform: `/admin`, `/admin/laporan`, `/admin/laporan/:code`, `/admin/kategori`, `/admin/statistik`.

Halaman sistem: `/403` untuk akses ditolak; rute lain yang tidak dikenal menampilkan 404.

## Responsif dan aksesibilitas

Layout dimulai dari layar kecil, dengan breakpoint 430, 760, dan 1000 px untuk halaman publik, 640, 900, dan 1024 px untuk ruang kerja pelapor, serta 640, 900, dan 1400 px untuk ruang kerja admin. Pada ukuran penerimaan 360, 768, dan 1280 px konten mengalir tanpa lebar tetap. Status selalu berikon dan berteks, field memiliki label, kontrol interaktif memiliki fokus terlihat, serta tinggi tombol minimum 44 px. Warna status memakai pasangan latar/teks gelap; aksi utama memakai oranye #F97316 dengan teks navy #0F172A yang tetap sama saat hover (tanpa perubahan warna teks, transparansi, atau bayangan tambahan).
