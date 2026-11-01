# LaporinAja — Backend

Express + Prisma backend for LaporinAja using PostgreSQL. All MVP contract endpoints are under `/api`. The frontend is a separate React application.

## Table of contents

- [Requirements](#requirements)
- [Quick start (local)](#quick-start-local)
- [Quick start (Docker)](#quick-start-docker)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Frontend integration](#frontend-integration)
- [API contract](#api-contract)
- [Project structure](#project-structure)
- [Running tests](#running-tests)

---

## Requirements

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Cloudinary account (free tier works for demo)

---

## Quick start (local)

```sh
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, SESSION_SECRET,
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# 3. Apply database migrations
npm run db:deploy

# 4. Generate Prisma client
npm run prisma:generate

# 5. Seed categories + demo accounts + demo reports
npm run db:seed

# 6. Start development server (hot reload)
npm run dev
```

API is now available at **http://localhost:3000**.  
Health check: `GET http://localhost:3000/health` → `{ "status": "ok" }`

---

## Quick start (Docker)

```sh
cp .env.example .env
# Edit .env — fill in Cloudinary credentials at minimum

docker compose up --build
```

Docker Compose will:
1. Start PostgreSQL 17 and wait until it is healthy
2. Build the API image, apply migrations, run seed, then start Express

API: **http://localhost:3000** — PostgreSQL data persists in the `postgres_data` volume.

To stop and remove containers (keep data):
```sh
docker compose down
```

To also delete the database volume (irreversible):
```sh
docker compose down --volumes
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in all required values.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | — | Min 32 chars, random string |
| `CLOUDINARY_CLOUD_NAME` | ✅ | — | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | ✅ | — | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | ✅ | — | From Cloudinary dashboard |
| `PORT` | | `3000` | API listen port |
| `FRONTEND_ORIGINS` | | `http://localhost:5173` | Comma-separated allowed origins |
| `SESSION_COOKIE_SECURE` | | `false` | Set `true` for HTTPS deployments |
| `SESSION_TTL_DAYS` | | `7` | Session lifetime in days |
| `GOOGLE_CLIENT_ID` | | — | Required only for Google login |
| `CLOUDINARY_FOLDER` | | `laporinaja` | Cloudinary upload folder |
| `MAX_UPLOAD_REQUEST_BYTES` | | `20971520` | 20 MB max multipart request |
| `POSTGRES_DB` | | `laporinaja` | Docker Compose only |
| `POSTGRES_USER` | | `laporinaja` | Docker Compose only |
| `POSTGRES_PASSWORD` | | `laporinaja_dev` | Docker Compose only |
| `POSTGRES_PORT` | | `5432` | Docker Compose only |

> **Security note:** `SESSION_SECRET` must be a strong random secret and must never be committed to version control. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

---

## Demo accounts

After running `npm run db:seed`, the following accounts are available:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `Admin1234!` |
| Pelapor | `budi@demo.test` | `Budi1234!` |
| Pelapor | `siti@demo.test` | `Siti1234!` |

The seed also creates **18 demo reports** covering all status values:

| Status | Count | Notes |
|---|---|---|
| `SUBMITTED` | 4 | Awaiting review |
| `VERIFIED` | 3 | Confirmed by admin, including 1 hidden |
| `IN_PROGRESS` | 3 | Being handled |
| `RESOLVED` | 3 | Completed with follow-up notes |
| `REJECTED` | 2 | With rejection reasons |
| `DUPLICATE` | 1 | Demo entry per PRD §20; automated action remains a Should |

The seed is **idempotent** — running `npm run db:seed` multiple times is safe. Categories are upserted, users are upserted by fixed UUID, and reports are skipped if the UUID already exists.

---

## Frontend integration

The local/demo topology is:

| | Value |
|---|---|
| React dev server | `http://localhost:5173` |
| API base URL | `http://localhost:3000` |
| Cookie `SameSite` | `Lax` |
| Cookie `Secure` | `false` (local HTTP) |

### CORS and credentials

All browser requests to the API must include credentials:

```ts
// fetch
fetch("http://localhost:3000/api/auth/me", { credentials: "include" });

// axios
axios.defaults.withCredentials = true;
```

The API allows only origins listed in `FRONTEND_ORIGINS`. Any other origin receives `403 ORIGIN_FORBIDDEN`.

### CSRF protection

All mutating requests (`POST`, `PATCH`, `DELETE`) from an authenticated session require the `X-CSRF-Token` header. The CSRF token is set as a **readable** (non-HttpOnly) cookie named `laporinaja_csrf` at login. Read it in your frontend and attach it to every mutation:

```ts
function getCsrfToken(): string {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("laporinaja_csrf="))
    ?.split("=")[1] ?? "";
}

// Example mutation
fetch("http://localhost:3000/api/reports", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRF-Token": getCsrfToken() },
  body: formData,           // multipart — do NOT set Content-Type manually
});
```

For `application/json` mutations, also set `Content-Type`:

```ts
fetch("http://localhost:3000/api/auth/logout", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": getCsrfToken(),
  },
});
```

### File uploads

Submit photos as `multipart/form-data` using the field name `photos` (max 3 files, 5 MB each). Let the browser set `Content-Type` (do not set it manually — the boundary must be browser-generated):

```ts
const form = new FormData();
form.append("categoryId", "1");
form.append("title", "...");
// ... other fields
form.append("photos", file1);
form.append("photos", file2);

fetch("http://localhost:3000/api/reports", {
  method: "POST",
  credentials: "include",
  headers: { "X-CSRF-Token": getCsrfToken() },
  body: form,
});
```

### Session flow

```
POST /api/auth/login  →  sets laporinaja_session (HttpOnly) + laporinaja_csrf (readable)
GET  /api/auth/me     →  returns { data: { id, name, role } }
POST /api/auth/logout →  requires X-CSRF-Token, clears both cookies
```

Google sign-in:
```ts
// After Google Identity Services returns a credential token
fetch("http://localhost:3000/api/auth/google", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ credential: googleIdToken }),
});
```

---

## API contract

### Response envelopes

```jsonc
// Success (single)
{ "data": { ... } }

// Success (list)
{ "data": [...], "meta": { "page": 1, "limit": 12, "total": 42 } }

// List with status counts (authenticated owner/admin)
{ "data": [...], "meta": { ... }, "counts": { "SUBMITTED": 2, "VERIFIED": 1, ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Pesan dalam bahasa Indonesia" } }

// Validation error with field details
{ "error": { "code": "VALIDATION_ERROR", "message": "Data tidak valid", "fields": { "email": "Email tidak valid" } } }
```

### Endpoint groups

| Group | Prefix | Auth required |
|---|---|---|
| Health | `/health` | No |
| Auth | `/api/auth` | Varies |
| Categories | `/api/categories` | No |
| Public reports | `/api/reports` | No |
| My reports | `/api/me/reports` | PELAPOR |
| Admin reports | `/api/admin/reports` | ADMIN |
| Public stats | `/api/stats/public` | No |
| Admin stats | `/api/admin/stats` | ADMIN |
| Media proxy | `/api/media/:id` | Varies |

### Key endpoints

```
GET    /api/categories
GET    /api/reports                    ?category=&status=&district=&village=&page=&limit=
GET    /api/reports/:code

POST   /api/reports                    multipart/form-data, PELAPOR + CSRF
GET    /api/me/reports                 ?status=
GET    /api/me/reports/:code

GET    /api/admin/reports              ?status=&category=
GET    /api/admin/reports/:code
POST   /api/admin/reports/:code/follow-ups   multipart/form-data, ADMIN + CSRF
POST   /api/admin/reports/:code/status       JSON, ADMIN + CSRF

GET    /api/stats/public
GET    /api/admin/stats                ADMIN

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/google
POST   /api/auth/logout                CSRF required
GET    /api/auth/me
```

---

## Project structure

```
prisma/
  migrations/         Database migrations (SQL)
  schema.prisma       Data models, enums, and relations
  seed.ts             Idempotent seed: categories + demo users + demo reports
src/
  app.ts              Express app setup (middleware pipeline)
  server.ts           HTTP server entry point
  db.ts               Prisma client singleton
  config/
    env.ts            Typed environment variable loader
  controllers/
    auth.controller.ts
    media.controller.ts
    report.controller.ts
    stats.controller.ts
  middlewares/
    auth.ts           Session, CSRF, requireAuth, requireRole, optionalAuth
    errors.ts         Global error handler (no stack traces in response)
    security.ts       CORS + Origin allowlist
  routes/
    index.ts          Router aggregator
    auth.routes.ts
    health.routes.ts
    media.routes.ts
    reports.routes.ts
    stats.routes.ts
  services/
    auth.service.ts
    media.service.ts
    report.service.ts
    stats.service.ts
  types/
    express.d.ts      Extend req.user, req.sessionToken, req.csrfHash
  utils/
    http-error.ts     HttpError class
    media-signature.ts  HMAC-signed media URL generation and validation
    public-code.ts    PostgreSQL sequence-based LPR-YYYY-NNNNNN generator
    responses.ts      sendData / sendList helpers
    uploads.ts        Sharp image validation + Cloudinary upload/delete
    validation.ts     parseBody / parseQuery / pagination helpers
tests/
  api-contract.test.ts   Mocked contract tests (28 cases)
  setup.ts
```

---

## Running tests

```sh
npm test
```

Tests use Vitest with mocked Prisma, Cloudinary, and argon2. No running database or Cloudinary account is needed. All 28 test cases cover:

- Response envelopes and HTTP status codes
- CORS / Origin enforcement
- Cookie-based session login/logout with CSRF
- Authorization (role, suspended account)
- Input validation with Indonesian field errors
- Idempotent report submission
- Image upload validation and Cloudinary transaction safety
- Status transition rules and conflict detection
- Public report privacy (no reporter identity leaks)
- Public and admin statistics with edge cases (empty data → zero)
- Signed media access control
