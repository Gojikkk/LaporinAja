# LaporinAja

Platform pelaporan masalah fasilitas publik dengan frontend React dan backend Express.

## Struktur repository

- [`backend/`](./backend/) — Express, TypeScript, Prisma, PostgreSQL, dan dokumentasi API.
- [`frontend/`](./frontend/) — React, TypeScript, dan Vite.
- [`compose.yaml`](./compose.yaml) — Docker Compose untuk backend dan PostgreSQL.

## Menjalankan aplikasi

### Backend

```sh
cd backend
npm install
cp .env.example .env
# Isi DATABASE_URL, SESSION_SECRET, dan kredensial Cloudinary di .env
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev
```

API tersedia di **http://localhost:3000**.

### Frontend

Di terminal lain, dari root repository:

```sh
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend tersedia di **http://localhost:5173**.

### Docker

Jalankan dari root repository. Salin `backend/.env.example` ke `.env` di root, isi kredensial Cloudinary, lalu jalankan:

```sh
docker compose up --build
```

Lihat [`backend/README.md`](./backend/README.md) untuk dokumentasi backend, environment variables, dan kontrak API. Lihat [`frontend/README.md`](./frontend/README.md) untuk dokumentasi frontend.
