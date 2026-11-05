import type { OAS3Options } from "swagger-jsdoc";

// ---------------------------------------------------------------------------
// Reusable schema components
// ---------------------------------------------------------------------------

const components = {
  securitySchemes: {
    cookieAuth: {
      type: "apiKey",
      in: "cookie",
      name: "laporinaja_session",
      description:
        "HttpOnly session cookie yang di-set otomatis saat login. Browser mengirimnya secara otomatis pada setiap request.",
    },
  },
  schemas: {
    SuccessEnvelope: {
      type: "object",
      properties: { data: { description: "Payload response" } },
      required: ["data"],
    },
    ListMeta: {
      type: "object",
      properties: {
        page:  { type: "integer", example: 1 },
        limit: { type: "integer", example: 12 },
        total: { type: "integer", example: 42 },
      },
      required: ["page", "limit", "total"],
    },
    ErrorEnvelope: {
      type: "object",
      properties: {
        error: {
          type: "object",
          properties: {
            code:    { type: "string", example: "VALIDATION_ERROR" },
            message: { type: "string", example: "Data tidak valid" },
            fields: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { email: "Email tidak valid" },
            },
          },
          required: ["code", "message"],
        },
      },
      required: ["error"],
    },
    UserRole: { type: "string", enum: ["PELAPOR", "ADMIN"] },
    ReportStatus: {
      type: "string",
      enum: ["SUBMITTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED", "DUPLICATE"],
    },
    PublicReportStatus: {
      type: "string",
      enum: ["VERIFIED", "IN_PROGRESS", "RESOLVED", "DUPLICATE"],
    },
    UserProfile: {
      type: "object",
      properties: {
        id:   { type: "string", format: "uuid", example: "c9a0c234-cbc6-4593-b9ed-f7bf8a400001" },
        name: { type: "string", example: "Budi Santoso" },
        role: { $ref: "#/components/schemas/UserRole" },
      },
      required: ["id", "name", "role"],
    },
    Category: {
      type: "object",
      properties: {
        id:   { type: "integer", example: 1 },
        name: { type: "string", example: "Lampu jalan" },
        slug: { type: "string", example: "lampu-jalan" },
      },
      required: ["id", "name", "slug"],
    },
    AdminCategory: {
      allOf: [
        { $ref: "#/components/schemas/Category" },
        {
          type: "object",
          properties: { isActive: { type: "boolean", example: true } },
          required: ["isActive"],
        },
      ],
    },
    Notification: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        type: { type: "string", example: "REPORT_STATUS_CHANGED" },
        message: { type: "string", example: "Laporan Anda telah diverifikasi." },
        isRead: { type: "boolean", example: false },
        createdAt: { type: "string", format: "date-time" },
        reportCode: { type: "string", example: "LPR-2026-000001" },
        reportUrl: { type: "string", example: "/laporan/LPR-2026-000001" },
      },
      required: ["id", "type", "message", "isRead", "createdAt", "reportCode", "reportUrl"],
    },
    ReportListItem: {
      type: "object",
      properties: {
        code:         { type: "string", example: "LPR-2026-000001" },
        title:        { type: "string", example: "Lampu jalan mati di depan SDN 01 Menteng" },
        category:     { $ref: "#/components/schemas/Category" },
        district:     { type: "string", example: "Menteng" },
        village:      { type: "string", example: "Menteng" },
        status:       { $ref: "#/components/schemas/ReportStatus" },
        thumbnailUrl: { type: "string", nullable: true, example: "/api/media/uuid?expires=...&signature=..." },
        createdAt:    { type: "string", format: "date-time" },
      },
    },
    TimelineEntry: {
      type: "object",
      properties: {
        fromStatus: { $ref: "#/components/schemas/ReportStatus" },
        toStatus:   { $ref: "#/components/schemas/ReportStatus" },
        actorLabel: { type: "string", example: "Administrator platform" },
        reason:     { type: "string", nullable: true },
        createdAt:  { type: "string", format: "date-time" },
      },
    },
    FollowUpPublic: {
      type: "object",
      properties: {
        note:                  { type: "string" },
        isResolutionNote:      { type: "boolean" },
        resolutionExplanation: { type: "string", nullable: true },
        createdAt:             { type: "string", format: "date-time" },
      },
    },
    FollowUpOwner: {
      allOf: [
        { $ref: "#/components/schemas/FollowUpPublic" },
        {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            evidences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url:      { type: "string" },
                  mimeType: { type: "string" },
                  altText:  { type: "string", nullable: true },
                },
              },
            },
          },
        },
      ],
    },
    ReportDetailPublic: {
      allOf: [
        { $ref: "#/components/schemas/ReportListItem" },
        {
          type: "object",
          properties: {
            description:    { type: "string" },
            city:           { type: "string", example: "Jakarta Pusat" },
            locationDetail: { type: "string" },
            duplicateOf: {
              type: "object",
              nullable: true,
              description: "Referensi laporan utama untuk laporan berstatus DUPLICATE; tidak berisi identitas pribadi.",
              properties: {
                code: { type: "string", example: "LPR-2026-000002" },
                url: { type: "string", example: "/laporan/LPR-2026-000002" },
              },
            },
            photos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url:      { type: "string" },
                  mimeType: { type: "string", example: "image/jpeg" },
                },
              },
            },
            timeline:  { type: "array", items: { $ref: "#/components/schemas/TimelineEntry" } },
            followUps: { type: "array", items: { $ref: "#/components/schemas/FollowUpPublic" } },
            evidences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url:      { type: "string" },
                  mimeType: { type: "string" },
                  altText:  { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      ],
    },
    ReportDetailOwner: {
      allOf: [
        { $ref: "#/components/schemas/ReportDetailPublic" },
        {
          type: "object",
          properties: {
            followUps: { type: "array", items: { $ref: "#/components/schemas/FollowUpOwner" } },
          },
        },
      ],
    },
    ReportDetailAdmin: {
      allOf: [
        { $ref: "#/components/schemas/ReportDetailOwner" },
        {
          type: "object",
          properties: {
            reporterName: { type: "string", example: "Budi Santoso" },
            isHidden:     { type: "boolean", example: false },
          },
        },
      ],
    },
    StatusCounts: {
      type: "object",
      properties: {
        SUBMITTED:   { type: "integer" },
        VERIFIED:    { type: "integer" },
        IN_PROGRESS: { type: "integer" },
        RESOLVED:    { type: "integer" },
        REJECTED:    { type: "integer" },
        DUPLICATE:   { type: "integer" },
      },
    },
    PublicStats: {
      type: "object",
      properties: {
        total:              { type: "integer", example: 42 },
        byStatus:           { $ref: "#/components/schemas/StatusCounts" },
        statusDistribution: { $ref: "#/components/schemas/StatusCounts" },
        byCategory: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:    { type: "integer" },
              name:  { type: "string" },
              slug:  { type: "string" },
              count: { type: "integer" },
            },
          },
        },
        resolved:       { type: "integer", example: 10 },
        completionRate: { type: "number", example: 40.0, description: "RESOLVED / (VERIFIED + IN_PROGRESS + RESOLVED) × 100" },
        asOf:           { type: "string", format: "date-time" },
        label:          { type: "string", example: "Data demonstrasi" },
      },
    },
    AdminStats: {
      type: "object",
      properties: {
        total:                   { type: "integer" },
        submissions:             { type: "integer" },
        byStatus:                { $ref: "#/components/schemas/StatusCounts" },
        statusDistribution:      { $ref: "#/components/schemas/StatusCounts" },
        verificationRate:        { type: "number", example: 75.0 },
        followUpCoverage:        { type: "number", example: 66.67 },
        averageTimeToVerifiedMs: { type: "integer", example: 86400000 },
        resolvedWithProofRate:   { type: "number", example: 100 },
        asOf:                    { type: "string", format: "date-time" },
      },
    },
  },
  parameters: {
    PageParam: {
      name: "page", in: "query",
      schema: { type: "integer", default: 1, minimum: 1 },
      description: "Halaman yang diminta",
    },
    LimitParam: {
      name: "limit", in: "query",
      schema: { type: "integer", default: 12, minimum: 1, maximum: 50 },
      description: "Jumlah item per halaman (maks 50)",
    },
    ReportCodeParam: {
      name: "code", in: "path", required: true,
      schema: { type: "string", pattern: "^LPR-\\d{4}-\\d{6,}$", example: "LPR-2026-000001" },
      description: "Kode publik laporan",
    },
    StatusFilterParam: {
      name: "status", in: "query",
      schema: { $ref: "#/components/schemas/ReportStatus" },
      description: "Filter berdasarkan status laporan",
    },
    CategorySlugParam: {
      name: "category", in: "query",
      schema: { type: "string", example: "lampu-jalan" },
      description: "Filter berdasarkan slug kategori",
    },
    DistrictParam: {
      name: "district", in: "query",
      schema: { type: "string", example: "Menteng" },
      description: "Filter berdasarkan kecamatan",
    },
    VillageParam: {
      name: "village", in: "query",
      schema: { type: "string", example: "Menteng" },
      description: "Filter berdasarkan kelurahan",
    },
    CsrfHeader: {
      name: "X-CSRF-Token", in: "header", required: true,
      schema: { type: "string" },
      description: "Nilai dari cookie laporinaja_csrf",
    },
  },
  responses: {
    "401": {
      description: "Tidak terautentikasi",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
    },
    "403": {
      description: "Akses ditolak (role tidak sesuai atau CSRF tidak valid)",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
    },
    "404": {
      description: "Tidak ditemukan",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
    },
    "422": {
      description: "Validasi input gagal",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
    },
    "429": {
      description: "Rate limit tercapai",
      content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
    },
  },
};

// ---------------------------------------------------------------------------
// Paths — setiap path object berisi semua HTTP method-nya sekaligus
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paths: Record<string, any> = {

  // =========================================================================
  // System
  // =========================================================================

  "/health": {
    get: {
      tags: ["System"],
      summary: "Health check",
      description: "Digunakan oleh Docker healthcheck dan load balancer.",
      responses: {
        "200": {
          description: "Server berjalan normal",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { status: { type: "string", example: "ok" } },
              },
            },
          },
        },
      },
    },
  },

  // =========================================================================
  // Auth
  // =========================================================================

  "/api/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Daftar akun pelapor baru",
      description: "Mendaftarkan akun baru dengan role PELAPOR. Role tidak dapat dipilih dari request.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "email", "password"],
              properties: {
                name:     { type: "string", minLength: 2, maxLength: 100, example: "Budi Santoso" },
                email:    { type: "string", format: "email", example: "budi@example.com" },
                password: { type: "string", minLength: 8, maxLength: 128, example: "Password123!" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Akun berhasil dibuat",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/UserProfile" } } },
            },
          },
        },
        "409": { description: "Email sudah digunakan", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "422": { $ref: "#/components/responses/422" },
        "429": { $ref: "#/components/responses/429" },
      },
    },
  },

  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Login dengan email dan password",
      description:
        "Mengembalikan data user dan menge-set dua cookie:\n" +
        "- `laporinaja_session` (HttpOnly) — JWT session token\n" +
        "- `laporinaja_csrf` (readable) — CSRF token yang harus dikirim sebagai header `X-CSRF-Token` di setiap mutasi",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email:    { type: "string", format: "email", example: "budi@demo.test" },
                password: { type: "string", example: "Budi1234!" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Login berhasil. Cookies di-set otomatis.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/UserProfile" } } },
            },
          },
        },
        "401": { description: "Email atau password salah", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "422": { $ref: "#/components/responses/422" },
        "429": { $ref: "#/components/responses/429" },
      },
    },
  },

  "/api/auth/google": {
    post: {
      tags: ["Auth"],
      summary: "Login / daftar via Google",
      description: "Verifikasi Google ID token. Jika email belum terdaftar, akun PELAPOR baru dibuat otomatis.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["credential"],
              properties: {
                credential: {
                  type: "string",
                  description: "Google ID token dari Google Identity Services",
                  example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Login berhasil",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/UserProfile" } } },
            },
          },
        },
        "401": { description: "Token Google tidak valid", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "429": { $ref: "#/components/responses/429" },
      },
    },
  },

  "/api/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Logout dan hapus session",
      description: "Menghapus session dari database dan meng-clear kedua cookie. Membutuhkan header `X-CSRF-Token`.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/CsrfHeader" }],
      responses: {
        "200": {
          description: "Logout berhasil",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: { type: "object", properties: { ok: { type: "boolean", example: true } } } },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },

  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Ambil profil user yang sedang login",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Profil user",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/UserProfile" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },

  // =========================================================================
  // Categories
  // =========================================================================

  "/api/categories": {
    get: {
      tags: ["Categories"],
      summary: "Daftar kategori laporan yang aktif",
      description: "Mengembalikan semua kategori aktif dalam urutan ID ascending.",
      responses: {
        "200": {
          description: "Daftar kategori",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: { type: "array", items: { $ref: "#/components/schemas/Category" } } },
              },
            },
          },
        },
      },
    },
  },

  "/api/admin/categories": {
    get: {
      tags: ["Admin Categories"],
      summary: "Daftar semua kategori",
      description: "Hanya ADMIN. Menampilkan kategori aktif dan nonaktif.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Daftar kategori",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: { type: "array", items: { $ref: "#/components/schemas/AdminCategory" } } },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
    post: {
      tags: ["Admin Categories"],
      summary: "Buat kategori",
      description: "Hanya ADMIN. Nama 3–60 karakter; nama dan slug harus unik.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/CsrfHeader" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "slug"],
              properties: {
                name: { type: "string", minLength: 3, maxLength: 60 },
                slug: { type: "string", minLength: 3, maxLength: 60, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
                isActive: { type: "boolean", default: true },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Kategori berhasil dibuat",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/AdminCategory" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "422": { $ref: "#/components/responses/422" },
      },
    },
  },
  "/api/admin/categories/{id}": {
    patch: {
      tags: ["Admin Categories"],
      summary: "Perbarui atau nonaktifkan kategori",
      description:
        "Hanya ADMIN. Minimal satu field dikirim. Gunakan `isActive=false` untuk menonaktifkan kategori; kategori yang dipakai laporan lama tidak dihapus.",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer", minimum: 1 },
        },
        { $ref: "#/components/parameters/CsrfHeader" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              minProperties: 1,
              properties: {
                name: { type: "string", minLength: 3, maxLength: 60 },
                slug: { type: "string", minLength: 3, maxLength: 60, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
                isActive: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Kategori berhasil diperbarui",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/AdminCategory" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
        "422": { $ref: "#/components/responses/422" },
      },
    },
  },

  // =========================================================================
  // Public Reports
  // =========================================================================

  "/api/reports": {
    get: {
      tags: ["Public Reports"],
      summary: "Daftar laporan publik",
      description:
        "Mengembalikan laporan yang tidak hidden dengan status publik (VERIFIED, IN_PROGRESS, RESOLVED, DUPLICATE).\n\n" +
        "Parameter `q` mencari kata kunci tanpa membedakan huruf besar/kecil pada kode, judul, deskripsi, lokasi, dan kategori. " +
        "Pencarian dapat digabung dengan filter dan pagination; hanya laporan publik yang tidak hidden akan dikembalikan.",
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
        {
          name: "q", in: "query",
          schema: { type: "string", minLength: 1, maxLength: 100 },
          description: "Kata kunci opsional, 1–100 karakter",
        },
        {
          name: "status", in: "query",
          schema: { $ref: "#/components/schemas/PublicReportStatus" },
          description: "Filter status (hanya status publik)",
        },
        { $ref: "#/components/parameters/CategorySlugParam" },
        { $ref: "#/components/parameters/DistrictParam" },
        { $ref: "#/components/parameters/VillageParam" },
      ],
      responses: {
        "200": {
          description: "Daftar laporan publik",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/ReportListItem" } },
                  meta: { $ref: "#/components/schemas/ListMeta" },
                },
              },
            },
          },
        },
        "400": {
          description: "Parameter tidak valid (mis. filter status non-publik)",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
      },
    },
    post: {
      tags: ["My Reports"],
      summary: "Buat laporan baru (PELAPOR)",
      description:
        "Mengirim laporan baru dengan 1–3 foto. Request harus `multipart/form-data`.\n\n" +
        "Gunakan `submissionKey` (UUID v4) untuk idempotency — jika key yang sama sudah ada, mengembalikan laporan existing dengan status 200.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/CsrfHeader" }],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["categoryId", "title", "description", "city", "district", "village", "locationDetail", "submissionKey", "photos"],
              properties: {
                categoryId:     { type: "integer", example: 2, description: "ID dari GET /api/categories" },
                title:          { type: "string", minLength: 10, maxLength: 100, example: "Lampu jalan mati di depan sekolah" },
                description:    { type: "string", minLength: 30, maxLength: 1000, example: "Lampu penerangan jalan sudah mati sejak seminggu lalu dan membahayakan pejalan kaki." },
                city:           { type: "string", maxLength: 100, example: "Jakarta Pusat" },
                district:       { type: "string", maxLength: 100, example: "Menteng" },
                village:        { type: "string", maxLength: 100, example: "Menteng" },
                locationDetail: { type: "string", minLength: 5, maxLength: 200, example: "Depan gerbang SDN 01 Menteng" },
                submissionKey:  { type: "string", format: "uuid", example: "7f3e2cee-c90c-4a54-b12a-5a9c65a13590", description: "UUID v4 unik per submit. Idempotency key." },
                photos: {
                  type: "array",
                  items: { type: "string", format: "binary" },
                  minItems: 1,
                  maxItems: 3,
                  description: "1–3 foto JPG/PNG/WebP, maks 5 MB per file",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Laporan baru berhasil dibuat",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      code:   { type: "string", example: "LPR-2026-000021" },
                      status: { type: "string", example: "SUBMITTED" },
                    },
                  },
                },
              },
            },
          },
        },
        "200": {
          description: "Laporan sudah ada — idempotency key match",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      code:   { type: "string" },
                      status: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "422": { $ref: "#/components/responses/422" },
        "429": {
          description: "Batas 5 laporan per 24 jam tercapai",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
      },
    },
  },

  "/api/reports/{code}": {
    get: {
      tags: ["Public Reports"],
      summary: "Detail laporan publik berdasarkan kode",
      description: "Mengembalikan detail laporan. Identitas pelapor dan alasan penolakan tidak pernah bocor ke response ini.",
      parameters: [{ $ref: "#/components/parameters/ReportCodeParam" }],
      responses: {
        "200": {
          description: "Detail laporan",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/ReportDetailPublic" } } },
            },
          },
        },
        "404": { $ref: "#/components/responses/404" },
      },
    },
  },

  // =========================================================================
  // My Reports (PELAPOR)
  // =========================================================================

  "/api/me/reports": {
    get: {
      tags: ["My Reports"],
      summary: "Daftar laporan milik pelapor yang login",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
        { $ref: "#/components/parameters/StatusFilterParam" },
      ],
      responses: {
        "200": {
          description: "Daftar laporan + status counts",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data:   { type: "array", items: { $ref: "#/components/schemas/ReportListItem" } },
                  meta:   { $ref: "#/components/schemas/ListMeta" },
                  counts: { $ref: "#/components/schemas/StatusCounts" },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },

  "/api/me/reports/{code}": {
    get: {
      tags: ["My Reports"],
      summary: "Detail laporan milik pelapor",
      description: "Mengembalikan detail lengkap termasuk timeline dengan alasan perubahan status.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/ReportCodeParam" }],
      responses: {
        "200": {
          description: "Detail laporan pelapor",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/ReportDetailOwner" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
      },
    },
  },

  "/api/me/notifications": {
    get: {
      tags: ["My Notifications"],
      summary: "Daftar notifikasi milik pelapor",
      description: "Hanya menampilkan notifikasi milik sesi yang sedang login.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Daftar notifikasi terbaru",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Notification" } },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },
  "/api/me/notifications/{id}/read": {
    patch: {
      tags: ["My Notifications"],
      summary: "Tandai notifikasi sebagai dibaca",
      description: "Hanya dapat mengubah notifikasi milik pelapor yang sedang login. Pemilik lain menerima 404.",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        { $ref: "#/components/parameters/CsrfHeader" },
      ],
      responses: {
        "200": {
          description: "Notifikasi ditandai dibaca",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Notification" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
      },
    },
  },

  // =========================================================================
  // Admin Reports
  // =========================================================================

  "/api/admin/reports": {
    get: {
      tags: ["Admin Reports"],
      summary: "Daftar semua laporan (ADMIN)",
      description: "Mengembalikan semua laporan termasuk yang hidden.",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/PageParam" },
        { $ref: "#/components/parameters/LimitParam" },
        { $ref: "#/components/parameters/StatusFilterParam" },
        { $ref: "#/components/parameters/CategorySlugParam" },
      ],
      responses: {
        "200": {
          description: "Daftar laporan admin + status counts",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data:   { type: "array", items: { $ref: "#/components/schemas/ReportDetailAdmin" } },
                  meta:   { $ref: "#/components/schemas/ListMeta" },
                  counts: { $ref: "#/components/schemas/StatusCounts" },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },

  "/api/admin/reports/{code}": {
    get: {
      tags: ["Admin Reports"],
      summary: "Detail laporan (ADMIN)",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/ReportCodeParam" }],
      responses: {
        "200": {
          description: "Detail laporan dengan nama pelapor dan isHidden",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/ReportDetailAdmin" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
      },
    },
  },

  "/api/admin/reports/{code}/follow-ups": {
    post: {
      tags: ["Admin Reports"],
      summary: "Tambah catatan tindak lanjut",
      description:
        "Menambah catatan ke laporan berstatus VERIFIED atau IN_PROGRESS.\n\n" +
        "Jika `isResolutionNote=true`, wajib ada **foto bukti** ATAU **penjelasan ≥ 30 karakter**.",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/ReportCodeParam" },
        { $ref: "#/components/parameters/CsrfHeader" },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["note", "isResolutionNote"],
              properties: {
                note:                  { type: "string", minLength: 10, maxLength: 500, example: "Petugas PLN telah mengganti bohlam dan memperbaiki kabel." },
                isResolutionNote:      { type: "boolean", example: false, description: "true jika ini catatan penyelesaian akhir" },
                resolutionExplanation: { type: "string", maxLength: 500, description: "Wajib min 30 karakter jika isResolutionNote=true dan tidak ada foto" },
                photos: {
                  type: "array",
                  items: { type: "string", format: "binary" },
                  maxItems: 3,
                  description: "Foto bukti (opsional, maks 3 × 5 MB)",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Catatan berhasil ditambahkan",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      id:        { type: "string", format: "uuid" },
                      note:      { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
        "422": { $ref: "#/components/responses/422" },
      },
    },
  },

  "/api/admin/reports/{code}/status": {
    post: {
      tags: ["Admin Reports"],
      summary: "Ubah status laporan",
      description:
        "Mengubah status laporan dengan optimistic locking via `expectedStatus`.\n\n" +
        "**Transisi yang diizinkan:**\n" +
        "- `SUBMITTED` → `VERIFIED` atau `REJECTED`\n" +
        "- `SUBMITTED` → `DUPLICATE` dengan `duplicateOfCode` valid\n" +
        "- `VERIFIED` → `IN_PROGRESS`, `REJECTED`, atau `DUPLICATE` dengan `duplicateOfCode` valid\n" +
        "- `IN_PROGRESS` → `RESOLVED`\n" +
        "- `REJECTED` → `SUBMITTED`\n" +
        "- `RESOLVED` → `IN_PROGRESS` untuk membuka kembali laporan maksimal 14 hari sejak diselesaikan\n\n" +
        "Alasan minimal 10 karakter wajib untuk penolakan, koreksi dari `REJECTED` ke `SUBMITTED`, dan pembukaan kembali laporan. " +
        "Target duplikat harus berstatus `VERIFIED`, `IN_PROGRESS`, atau `RESOLVED`, dan bukan laporan itu sendiri. " +
        "Detail publik laporan duplikat berisi tautan laporan utama tanpa identitas pribadi. " +
        "Jika laporan utama kemudian `REJECTED`, perilakunya belum diputuskan (OQ-06); sistem tidak mengubah relasi otomatis. " +
        "Pembukaan kembali menyimpan alasan dan aktor dari sesi ke riwayat baru tanpa menghapus bukti lama.\n\n" +
        "Transisi ke `RESOLVED` hanya dapat dilakukan jika sudah ada catatan penyelesaian " +
        "beserta minimal satu foto bukti atau penjelasan tertulis minimal 30 karakter.",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/ReportCodeParam" },
        { $ref: "#/components/parameters/CsrfHeader" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["toStatus", "expectedStatus"],
              properties: {
                toStatus:       { $ref: "#/components/schemas/ReportStatus", description: "Status baru; DUPLICATE hanya dari SUBMITTED/VERIFIED" },
                expectedStatus: { $ref: "#/components/schemas/ReportStatus", description: "Status saat ini yang diharapkan (optimistic lock)" },
                reason:         { type: "string", minLength: 10, example: "Masalah muncul kembali setelah perbaikan.", description: "Wajib minimal 10 karakter untuk penolakan, koreksi dari REJECTED ke SUBMITTED, atau membuka kembali laporan RESOLVED" },
                duplicateOfCode: { type: "string", pattern: "^LPR-\\d{4}-\\d{6,}$", example: "LPR-2026-000002", description: "Wajib saat toStatus=DUPLICATE; target harus VERIFIED, IN_PROGRESS, atau RESOLVED dan bukan laporan ini" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Status berhasil diubah",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "object",
                    properties: {
                      code:      { type: "string", example: "LPR-2026-000001" },
                      status:    { $ref: "#/components/schemas/ReportStatus" },
                      historyId: { type: "string", format: "uuid" },
                    },
                  },
                },
              },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
        "404": { $ref: "#/components/responses/404" },
        "409": { description: "Status laporan sudah berubah (conflict)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "422": { $ref: "#/components/responses/422" },
      },
    },
  },

  // =========================================================================
  // Statistics
  // =========================================================================

  "/api/stats/public": {
    get: {
      tags: ["Statistics"],
      summary: "Statistik publik",
      description:
        "Total laporan terpublikasi, distribusi status/kategori, dan completion rate.\n\n" +
        "Formula: `completionRate = RESOLVED / (VERIFIED + IN_PROGRESS + RESOLVED) × 100` — DUPLICATE tidak dihitung.",
      responses: {
        "200": {
          description: "Statistik publik",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/PublicStats" } } },
            },
          },
        },
      },
    },
  },

  "/api/admin/stats": {
    get: {
      tags: ["Statistics"],
      summary: "Statistik admin",
      description:
        "Statistik lengkap semua laporan termasuk distribusi seluruh status, tingkat verifikasi, " +
        "cakupan catatan tindak lanjut, dan rata-rata waktu menuju VERIFIED.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Statistik admin",
          content: {
            "application/json": {
              schema: { type: "object", properties: { data: { $ref: "#/components/schemas/AdminStats" } } },
            },
          },
        },
        "401": { $ref: "#/components/responses/401" },
        "403": { $ref: "#/components/responses/403" },
      },
    },
  },

  // =========================================================================
  // Media
  // =========================================================================

  "/api/media/{id}": {
    get: {
      tags: ["Media"],
      summary: "Proxy gambar dengan akses kontrol",
      description:
        "Mengambil gambar dari Cloudinary dan meng-stream-nya ke client. URL valid 15 menit (HMAC-signed).\n\n" +
        "**Aturan akses:**\n" +
        "- Publik: laporan tidak hidden dengan status VERIFIED/IN_PROGRESS/RESOLVED/DUPLICATE\n" +
        "- Pelapor: bisa akses foto laporannya sendiri meski SUBMITTED\n" +
        "- Admin: bisa akses semua\n\n" +
        "URL didapat dari field `thumbnailUrl`, `photos[].url`, atau `evidences[].url` di response laporan.",
      parameters: [
        {
          name: "id", in: "path", required: true,
          schema: { type: "string", format: "uuid" },
          description: "UUID evidence",
        },
        {
          name: "expires", in: "query", required: true,
          schema: { type: "integer", example: 1730000000 },
          description: "Unix timestamp expiry (15 menit dari waktu generate)",
        },
        {
          name: "signature", in: "query", required: true,
          schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
          description: "HMAC-SHA256 hex signature",
        },
      ],
      responses: {
        "200": {
          description: "Binary gambar",
          content: {
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/png":  { schema: { type: "string", format: "binary" } },
            "image/webp": { schema: { type: "string", format: "binary" } },
          },
        },
        "404": { $ref: "#/components/responses/404" },
        "502": {
          description: "Gagal mengambil gambar dari Cloudinary",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Final swagger options export
// ---------------------------------------------------------------------------

export const swaggerOptions: OAS3Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LaporinAja API",
      version: "1.0.0",
      description:
        "REST API backend untuk platform pelaporan infrastruktur publik LaporinAja.\n\n" +
        "Semua mutasi yang membutuhkan autentikasi harus menyertakan header `X-CSRF-Token` " +
        "dengan nilai dari cookie `laporinaja_csrf`.\n\n" +
        "**Demo accounts:**\n" +
        "- `admin@demo.test` / `Admin1234!` — role ADMIN\n" +
        "- `budi@demo.test` / `Budi1234!` — role PELAPOR\n" +
        "- `siti@demo.test` / `Siti1234!` — role PELAPOR",
      contact: { name: "LaporinAja Team" },
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: [
      { name: "System",         description: "Health check" },
      { name: "Auth",           description: "Autentikasi dan manajemen session" },
      { name: "Categories",     description: "Kategori laporan" },
      { name: "Public Reports", description: "Laporan publik — tidak perlu login" },
      { name: "My Reports",     description: "Laporan milik pelapor yang sedang login (PELAPOR)" },
      { name: "Admin Reports",  description: "Manajemen laporan oleh admin (ADMIN)" },
      { name: "Statistics",     description: "Statistik laporan" },
      { name: "Media",          description: "Proxy gambar dengan akses kontrol" },
    ],
    components,
    paths,
  },
  apis: [],
};
