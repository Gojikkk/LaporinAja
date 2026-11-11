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

- `development` adalah branch integrasi/staging. Setiap push menjalankan tes dan build di GitHub Actions, lalu memicu deploy backend staging. Netlify juga membangun branch `development` ke URL staging tersendiri.
- Cek hasilnya di URL staging Netlify, termasuk login, laporan, dan upload. Setelah lolos, buat pull request `development` → `main`; merge ke `main` memperbarui situs production Netlify.
- Lindungi `main` di GitHub: **Settings → Branches → Add branch protection rule**, aktifkan **Require a pull request before merging** dan **Require status checks to pass** (`Backend tests and build`, `Frontend build`).
- Set default branch repository ke `development` di **Settings → General → Default branch** agar clone dan PR baru mengarah ke branch integrasi.

## Deploy staging: Netlify + Render + Neon

Frontend production tetap di Netlify (`laporinaja-app.netlify.app`). Backend staging berjalan sebagai Docker Web Service gratis di Render; databasenya Neon Free. Render free service dapat dipakai tanpa payment method, tidur setelah 15 menit idle, dan biasanya perlu sekitar satu menit untuk bangun. Kuotanya 750 jam instance per workspace per bulan; pemakaian bandwidth/build yang melewati kuota akan menghentikan layanan/build jika belum menambahkan payment method, bukan menagih kartu. Cocok untuk staging, bukan production yang butuh selalu aktif. Neon Free juga tidak memerlukan kartu; gunakan project/database terpisah untuk staging.

### Setup satu kali

1. Pastikan branch `development` sudah ada dan berisi perubahan terbaru.
2. Di Netlify, buka **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**. Aktifkan branch deploy untuk `development`. URL umumnya `https://development--laporinaja-app.netlify.app`.
3. Di pengaturan environment variables Netlify, buat `VITE_API_URL=/api` untuk context **Branch deploys**. Atur juga `VITE_GOOGLE_CLIENT_ID` pada context yang sesuai bila login Google digunakan. Production (`main`) tetap memakai `VITE_API_URL` production yang sudah ada.
4. Di Neon, buat database/project khusus staging dan salin kedua connection string: pooled URL untuk aplikasi dan direct URL untuk migrasi Prisma. Jangan gunakan database production.
5. Di Render, pilih **New → Blueprint**, hubungkan repository, dan deploy [Blueprint](./render.yaml). Pastikan Blueprint membuat hanya `laporinaja-staging-api`. Saat diminta, isi `DATABASE_URL` dengan pooled Neon URL, `DIRECT_URL` dengan direct Neon URL, serta tiga kredensial Cloudinary. `SESSION_SECRET` dibuat otomatis. Folder upload Cloudinary staging diset ke `laporinaja-staging`.
6. URL branch staging memakai Netlify proxy `/api/*` ke `https://laporinaja-staging-api.onrender.com`, agar cookie sesi tetap same-site. Jika Render memberi service URL berbeda, ubah target proxy di [netlify.toml](./netlify.toml) lalu push ke `development`. Pada environment Render, pastikan `FRONTEND_ORIGINS` berisi origin Netlify staging dan production, dipisahkan koma tanpa trailing slash. Jika URL staging Netlify berbeda, sesuaikan nilainya.
7. Di Render, buat **Deploy Hook** pada `laporinaja-staging-api`. Simpan URL-nya di GitHub repository **Settings → Secrets and variables → Actions** sebagai `RENDER_API_DEPLOY_HOOK`. Netlify branch deploy akan berjalan otomatis dari push; backend staging baru di-deploy oleh workflow setelah tes/build CI berhasil.
8. Push perubahan ke `development`. Tunggu GitHub Actions dan deploy Netlify selesai, lalu buka URL branch staging. Registrasi akun uji dilakukan di staging; jangan masukkan data pribadi/produksi.

`DATABASE_URL` pooled dipakai API, sedangkan `DIRECT_URL` (opsional lokal) dipakai Prisma untuk migrasi. Migrasi otomatis berjalan saat container API start. Blueprint sengaja tidak membuat database Render atau frontend Render. Render Free tidak menyediakan persistent disk; simpan gambar di Cloudinary. Jangan seed staging jika seed berisi akun/kredensial demo yang tidak ingin dipublikasikan.

### Alur kerja sehari-hari

Edit dan push ke `development` → GitHub Actions menguji backend/frontend dan deploy backend staging → Netlify memperbarui branch staging → cek hasil di URL staging → jika lolos, PR dan merge `development` ke `main`. Tidak perlu mengubah atau deploy dari `main` untuk mengecek pekerjaan development. Deploy otomatis Netlify dapat selesai terpisah dari CI; pemeriksaan build Netlify tetap berjalan sendiri.

### CI/CD otomatis ke Render

Workflow [GitHub Actions](./.github/workflows/ci-cd.yml) menjalankan tes backend, build backend, dan build frontend pada setiap push serta pull request ke `development` atau `main`. Deploy hanya berjalan setelah semua job tersebut berhasil.

- Push ke `development` mendeploy API staging jika `RENDER_API_DEPLOY_HOOK` diset. Jika belum, deploy backend dilewati dan CI tetap hijau. Netlify menangani branch deploy frontend secara langsung.
- Push ke `main` mendeploy production hanya jika `RENDER_API_DEPLOY_HOOK_PROD` dan `RENDER_WEB_DEPLOY_HOOK_PROD` diset.

Jika backend production juga masih di Render, hook production tetap terpisah sebagai `RENDER_API_DEPLOY_HOOK_PROD`. Jangan isi secret production dengan hook staging.

Jangan masukkan URL deploy hook atau kredensial ke repository, issue, maupun chat.

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
