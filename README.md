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

API tersedia di `http://localhost:3000`; health check di `/health`. Untuk menghentikan layanan, jalankan `docker compose down`.

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

## Progress saat ini

| Bagian | Status |
|---|---|
| Backend REST API untuk autentikasi, laporan, media, dan statistik | Tersedia |
| Login email/password dan Google | Tersedia |
| Upload foto laporan dan media | Tersedia melalui Cloudinary |
| Validasi request, CORS, CSRF, rate limit, dan session cookie | Tersedia |
| Migrasi database dan data demo | Tersedia melalui Prisma |
| Landing page, autentikasi, form laporan, dashboard pelapor/admin, dan statistik | UI tersedia |
| Data daftar/detail laporan dan dashboard | Sebagian masih menggunakan data demo in-memory |
| Integrasi frontend dengan API | Client dan beberapa form terhubung; integrasi semua halaman masih bertahap |
| Build frontend dan tes kontrak API backend | Tersedia |

## Struktur repository

```text
backend/    Express API, Prisma schema/migrations/seed, dan tes backend
frontend/   Aplikasi React dan Vite
compose.yaml
```

Lihat [README backend](./backend/README.md) untuk detail environment, API, dan pengujian. Lihat [README frontend](./frontend/README.md) untuk struktur halaman dan integrasi frontend.
