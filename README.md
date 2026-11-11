# LaporinAja

LaporinAja adalah platform pelaporan masalah fasilitas publik, seperti jalan rusak, lampu mati, dan sampah menumpuk. Aplikasi ini menyediakan antarmuka untuk membuat laporan serta API untuk autentikasi, pengelolaan laporan, dan pemantauan tindak lanjut.

## Tech stack

| Bagian | Teknologi |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router |
| Styling | CSS responsif kustom |
| Backend | Node.js 20+, Express 5, TypeScript |
| Database | PostgreSQL 17, Prisma 7 |
| Validasi dan keamanan API | Zod, session cookie HttpOnly, CSRF, CORS |
| Upload gambar | Multer, Sharp, Cloudinary |
| Testing backend | Vitest, Supertest |
| Development environment | Docker Compose |

## Prasyarat

- Git
- Node.js 20 atau lebih baru dan npm
- PostgreSQL 15 atau lebih baru, atau Docker Desktop
- Akun Cloudinary untuk fitur upload gambar

## Clone, install, dan jalankan

Clone repository:

```sh
git clone https://github.com/Gojikkk/backend-LaporinAja.git
cd backend-LaporinAja
```

### Opsi A: Jalankan backend dan database dengan Docker

Dari root repository, salin konfigurasi backend ke file environment Docker, lalu isi kredensial Cloudinary:

```sh
cp backend/.env.example .env
docker compose up --build
```

API tersedia di `http://localhost:3000`; health check di `/health`. Jika perlu data demo, jalankan seed sekali setelah API siap:

```sh
docker compose exec api npm run db:seed
```

Seed tidak lagi berjalan otomatis saat container restart. Untuk menghentikan layanan, jalankan `docker compose down`.

### Opsi B: Jalankan backend secara lokal

Pastikan PostgreSQL sedang berjalan. Dari root repository:

```sh
cd backend
npm install
cp .env.example .env
```

Isi `DATABASE_URL`, `SESSION_SECRET` (minimal 32 karakter), dan kredensial Cloudinary di `backend/.env`, kemudian jalankan:

```sh
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev
```

API tersedia di `http://localhost:3000`; dokumentasi Swagger di `http://localhost:3000/api-docs`.

### Jalankan frontend

Dengan backend berjalan, buka terminal lain dari root repository:

```sh
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Vite menyediakan frontend di `http://localhost:5173`. URL API default adalah `http://localhost:3000/api`; ubah `VITE_API_URL` di `frontend/.env.local` jika backend berjalan di alamat lain. Build produksi frontend dapat dibuat dengan `npm run build` dari folder `frontend/`.

## Alur branch

- `development` adalah branch integrasi. Push fitur ke branch ini untuk menjalankan tes dan deploy staging.
- `main` adalah branch stabil. Perubahan masuk lewat pull request dari `development` setelah staging lolos.
- Lindungi `main` di GitHub: **Settings → Branches → Add branch protection rule**, aktifkan **Require a pull request before merging** dan **Require status checks to pass** (`Backend tests and build`, `Frontend build`).
- Set default branch repository ke `development` di **Settings → General → Default branch** agar clone dan PR baru mengarah ke branch integrasi.

## Deploy staging ke Render

Repository menyediakan [Blueprint Render](./render.yaml) untuk PostgreSQL, API Docker, dan frontend static dengan plan Free. Dari Render, pilih **New → Blueprint** dan hubungkan repository. Blueprint memakai URL default `laporinaja-staging-web.onrender.com` dan `laporinaja-staging-api.onrender.com`; isi tiga kredensial Cloudinary saat diminta dan gunakan folder `laporinaja-staging`.

Setelah kedua service web dibuat, set:

- Jika URL Render yang diberikan berbeda dari default di atas, ubah `FRONTEND_ORIGINS` pada API ke origin frontend staging persis (tanpa trailing slash), dan `VITE_API_URL` pada frontend ke URL API staging ditambah `/api`.
- Biarkan `VITE_CSRF_ENDPOINT=/auth/csrf`, `SESSION_COOKIE_SECURE=true`, dan `SESSION_COOKIE_SAME_SITE=none` untuk HTTPS staging.

Perubahan environment frontend perlu di-build ulang. Migrasi database berjalan saat API start; Render tidak men-seed data demo otomatis. Di plan Free, Shell service API tidak tersedia, jadi buat akun uji lewat halaman registrasi. Gunakan database dan kredensial staging yang terpisah dari production.

**Batasan plan Free:** API akan sleep setelah 15 menit tanpa trafik dan perlu sekitar satu menit untuk bangun saat ada request. Database Free dibatasi 1 GB dan otomatis kedaluwarsa setelah 30 hari; data database akan dihapus setelah masa tenggang jika tidak di-upgrade. Static Site gratis. Cek pemakaian bandwidth/build dan spend limit di dashboard Render agar tidak kena biaya tambahan.

### CI/CD otomatis ke Render

Workflow [GitHub Actions](./.github/workflows/ci-cd.yml) menjalankan tes backend, build backend, dan build frontend pada setiap push serta pull request ke `development` atau `main`. Deploy hanya berjalan setelah semua job tersebut berhasil.

- Push ke `development` mendeploy staging jika `RENDER_API_DEPLOY_HOOK` dan `RENDER_WEB_DEPLOY_HOOK` diset. Jika belum, deploy dilewati dan CI tetap hijau.
- Push ke `main` mendeploy production hanya jika `RENDER_API_DEPLOY_HOOK_PROD` dan `RENDER_WEB_DEPLOY_HOOK_PROD` diset.

Untuk mengaktifkan deploy:

1. Di Render, buat deploy hook terpisah pada service `laporinaja-staging-api` dan `laporinaja-staging-web`.
2. Di GitHub, buka **Settings → Secrets and variables → Actions → New repository secret** dan simpan URL hook API sebagai `RENDER_API_DEPLOY_HOOK`, serta URL hook frontend sebagai `RENDER_WEB_DEPLOY_HOOK`.
3. Hubungkan Blueprint Render staging ke branch `development`. `autoDeployTrigger: off` mencegah Render melewati pemeriksaan CI dan hanya deploy saat workflow memanggil kedua hook.
4. Jika sudah punya service production, simpan hook-nya sebagai `RENDER_API_DEPLOY_HOOK_PROD` dan `RENDER_WEB_DEPLOY_HOOK_PROD`.
5. Buka **Actions** di GitHub untuk melihat hasil tes/build dan status pemicu deploy. Pantau penyelesaian deploy serta health check masing-masing service di Render.

Jangan masukkan URL deploy hook atau kredensial ke repository, issue, maupun chat. Workflow ini mendeploy konfigurasi staging Render yang tersedia di repository; database Free tetap sementara dan tidak cocok untuk menyimpan data production jangka panjang.

### Preview publik sementara tanpa kartu

Di Windows, jalankan `Start-Staging.bat` dari root repository. Script menyalakan Docker Desktop jika perlu, database staging lokal, API, frontend, dan Cloudflare Quick Tunnel. Untuk cek kebutuhan tanpa menyalakan preview, jalankan `.\start-staging.ps1 -CheckOnly`. URL publik serta akun admin demo akan ditampilkan di terminal. Pada database baru, script mengisi data demo dengan password admin acak yang disimpan di `%LOCALAPPDATA%\LaporinAja\staging-admin-password.txt`; jangan bagikan. Biarkan terminal tetap terbuka selama preview dipakai, lalu tekan `Ctrl+C` untuk berhenti. Database preview tetap tersimpan di Docker volume lokal.

Quick Tunnel memberikan URL sementara yang berubah saat dimulai ulang. Preview publik bukan deployment permanen; laptop dan koneksi internet harus aktif. Gunakan hanya data dummy karena siapa pun yang punya URL dapat mengakses preview.

## Progress saat ini

| Bagian | Status |
|---|---|
| Backend REST API untuk autentikasi, laporan, media, dan statistik | Tersedia |
| Login email/password dan Google | Tersedia |
| Upload foto laporan dan media | Tersedia melalui Cloudinary |
| Validasi request, CORS, CSRF, rate limit, dan session cookie | Tersedia |
| Migrasi database dan data demo | Tersedia melalui Prisma |
| Landing page, autentikasi, form laporan, dashboard pelapor/admin, dan statistik | UI tersedia |
| Data daftar/detail laporan dan dashboard | Dimuat langsung dari API backend |
| Integrasi frontend dengan API | Semua halaman memakai endpoint backend, termasuk sesi cookie dan CSRF |
| Login Google di frontend | Aktif bila `VITE_GOOGLE_CLIENT_ID` diisi; contoh tersedia di `frontend/.env.example` |
| Build frontend dan tes kontrak API backend | Tersedia |

## Struktur repository

```text
backend/    Express API, Prisma schema/migrations/seed, dan tes backend
frontend/   Aplikasi React dan Vite
compose.yaml
```

Lihat [README backend](./backend/README.md) untuk detail environment, API, dan pengujian. Lihat [README frontend](./frontend/README.md) untuk struktur halaman, integrasi, dan tutorial QA otomatis Playwright.
