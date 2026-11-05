import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
import jwt from "jsonwebtoken";
import { mediaUrl } from "../src/utils/media-signature";

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  const model = (methods: string[]) => Object.fromEntries(methods.map((method) => [method, fn()]));
  return {
    googleClient: { verifyIdToken: vi.fn() },
    cloudinary: {
      config: vi.fn(),
      uploader: { upload_stream: vi.fn(), destroy: vi.fn() },
      url: vi.fn()
    },
    emailService: { sendReportStatusEmail: vi.fn() },
    prisma: {
      session: model(["create", "findUnique", "deleteMany"]),
      user: model(["create", "findUnique", "update"]),
      reportCategory: model(["create", "findMany", "findFirst", "findUnique", "update"]),
      report: model(["count", "create", "createMany", "findFirst", "findUnique", "findMany", "updateMany"]),
      reportStatusHistory: model(["create", "findMany"]),
      reportFollowUp: model(["create", "findFirst", "findMany"]),
      reportEvidence: model(["create", "createMany", "findUnique", "findMany"]),
      notification: model(["create", "findMany", "findFirst", "updateMany"]),
      $transaction: fn(),
      $queryRaw: fn(),
      $executeRaw: fn()
    }
  };
});

vi.mock("../src/db", () => ({ prisma: mocks.prisma }));
vi.mock("cloudinary", () => ({ v2: mocks.cloudinary }));
vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("argon2-hash"),
    verify: vi.fn().mockResolvedValue(true)
  }
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(function OAuth2Client() {
    return mocks.googleClient;
  })
}));
vi.mock("../src/services/email.service", () => ({
  sendReportStatusEmail: mocks.emailService.sendReportStatusEmail
}));

import app from "../src/app";

const frontend = "http://localhost:5173";
const csrfToken = "test-csrf-token";
const csrfHash = createHash("sha256").update(csrfToken).digest("hex");
const user = {
  id: "c9a0c234-cbc6-4593-b9ed-f7bf8a400001",
  name: "Rani",
  role: "PELAPOR",
  accountStatus: "ACTIVE",
  deletedAt: null,
  passwordHash: "argon2-hash"
};

function sessionCookie(role: string = "PELAPOR"): string {
  mocks.prisma.session.findUnique.mockResolvedValue({
    id: "session-id",
    userId: user.id,
    expiresAt: new Date(Date.now() + 60_000),
    csrfHash,
    user: { ...user, role }
  });
  const token = jwt.sign({ sub: user.id, jti: "test-session" }, process.env.SESSION_SECRET!, {
    algorithm: "HS256",
    expiresIn: "1h"
  });
  return "laporinaja_session=" + token + "; laporinaja_csrf=" + csrfToken;
}

function mutationHeaders(role?: string) {
  return {
    Origin: frontend,
    Cookie: sessionCookie(role),
    "X-CSRF-Token": csrfToken
  };
}

function reportSubmission() {
  return request(app)
    .post("/api/reports")
    .set(mutationHeaders("PELAPOR"))
    .field("categoryId", "1")
    .field("title", "Lampu jalan mati dekat taman")
    .field("description", "Lampu jalan di dekat taman tidak menyala selama tiga malam.")
    .field("city", "Kota")
    .field("district", "Kecamatan")
    .field("village", "Kelurahan")
    .field("locationDetail", "Dekat taman utama")
    .field("submissionKey", "7f3e2cee-c90c-4a54-b12a-5a9c65a13590");
}

const reportData = {
  id: "91ab27ae-4f1c-4e31-87c9-f9ac11d1f6a2",
  publicCode: "LPR-2026-000001",
  reporterId: user.id,
  categoryId: 1,
  title: "Lampu jalan mati di depan sekolah",
  description: "Lampu jalan di depan sekolah sudah mati sejak beberapa malam lalu.",
  city: "Kota",
  district: "Kecamatan",
  village: "Kelurahan",
  locationDetail: "Dekat gerbang sekolah",
  status: "IN_PROGRESS",
  isHidden: false,
  createdAt: new Date("2026-10-26T00:00:00.000Z"),
  category: { id: 1, name: "Lampu jalan", slug: "lampu-jalan" },
  evidences: [],
  statusHistories: [],
  followUps: []
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.notification.create.mockReset();
  mocks.emailService.sendReportStatusEmail.mockResolvedValue(undefined);
  mocks.cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({
    end: (buffer: Buffer) => {
      const publicId = `${options.folder}/${options.public_id}`;
      callback(undefined, {
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/${publicId}`,
        format: "png",
        bytes: buffer.length
      });
    }
  }));
  mocks.cloudinary.url.mockImplementation(
    (key: string) => `https://res.cloudinary.com/test-cloud/image/authenticated/${key}`
  );
  mocks.cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });
  mocks.prisma.$transaction.mockImplementation(async (operations: unknown) => {
    if (typeof operations === "function") {
      return (operations as (tx: typeof mocks.prisma) => unknown)(mocks.prisma);
    }
    if (Array.isArray(operations)) return Promise.all(operations);
    return operations;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API contract transport and authentication", () => {
  it("exposes the server health endpoint", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("uses the standard envelope for an unknown endpoint", async () => {
    const response = await request(app).get("/api/unknown").set("Origin", frontend);
    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "NOT_FOUND",
      message: "Endpoint tidak ditemukan"
    });
  });

  it("allows credentialed CORS only for the configured frontend", async () => {
    const allowed = await request(app)
      .options("/api/auth/login")
      .set("Origin", frontend)
      .set("Access-Control-Request-Method", "POST");
    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(frontend);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const blocked = await request(app).get("/api/categories").set("Origin", "https://attacker.example");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("ORIGIN_FORBIDDEN");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects browser mutations without an allowed Origin", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Rani",
      email: "rani@example.test",
      password: "password123"
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_FORBIDDEN");
  });

  it("uses the standard field validation error envelope", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Origin", frontend)
      .send({ name: "A", email: "not-an-email", password: "short", role: "ADMIN" });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Data tidak valid"
    });
    expect(response.body.error.fields).toHaveProperty("name");
    expect(response.body.error.fields).toHaveProperty("email");
    expect(response.body.error.fields).toHaveProperty("password");
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it("registers only PELAPOR accounts and maps duplicate email to 409", async () => {
    mocks.prisma.user.create.mockResolvedValue({ id: user.id, name: "Rani", role: "PELAPOR" });
    const created = await request(app)
      .post("/api/auth/register")
      .set("Origin", frontend)
      .send({ name: "Rani", email: "RANI@EXAMPLE.TEST", password: "password123", role: "ADMIN" });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ data: { id: user.id, name: "Rani", role: "PELAPOR" } });
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: "rani@example.test", role: "PELAPOR" })
    }));

    mocks.prisma.user.create.mockRejectedValue({ code: "P2002" });
    const duplicate = await request(app)
      .post("/api/auth/register")
      .set("Origin", frontend)
      .send({ name: "Rani", email: "rani@example.test", password: "password123" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("sets an HttpOnly Lax session cookie, hides login failures and logs out with CSRF", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    const invalid = await request(app)
      .post("/api/auth/login")
      .set("Origin", frontend)
      .send({ email: "rani@example.test", password: "password123" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Email atau password salah");

    mocks.prisma.session.create.mockResolvedValue({});
    const login = await request(app)
      .post("/api/auth/login")
      .set("Origin", frontend)
      .send({ email: "RANI@example.test", password: "password123" });
    expect(login.status).toBe(200);
    expect(login.body.data).toEqual({ id: user.id, name: user.name, role: user.role });
    const loginSetCookie = login.headers["set-cookie"];
    const cookies = Array.isArray(loginSetCookie)
      ? loginSetCookie
      : typeof loginSetCookie === "string" ? [loginSetCookie] : [];
    expect(cookies.some((cookie) => cookie.includes("laporinaja_session=") &&
      cookie.includes("HttpOnly") && cookie.includes("SameSite=Lax"))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes("laporinaja_csrf="))).toBe(true);

    const missingCsrf = await request(app)
      .post("/api/auth/logout")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie());
    expect(missingCsrf.status).toBe(403);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie())
      .set("X-CSRF-Token", csrfToken);
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ data: { ok: true } });
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalled();
    const logoutSetCookie = logout.headers["set-cookie"];
    const clearedCookies = Array.isArray(logoutSetCookie)
      ? logoutSetCookie
      : typeof logoutSetCookie === "string" ? [logoutSetCookie] : [];
    expect(clearedCookies.some((cookie) => cookie.includes("laporinaja_session=;") &&
      /Expires=Thu, 01 Jan 1970/i.test(cookie))).toBe(true);
  });

  it("verifies a Google ID token before creating a session", async () => {
    mocks.googleClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "rani@example.test",
        email_verified: true,
        name: "Rani"
      })
    });
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    mocks.prisma.session.create.mockResolvedValue({});

    const response = await request(app)
      .post("/api/auth/google")
      .set("Origin", frontend)
      .send({ credential: "google-id-token" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: user.id, name: user.name, role: user.role });
    expect(mocks.googleClient.verifyIdToken).toHaveBeenCalledWith({
      idToken: "google-id-token",
      audience: "test-google-client-id.apps.googleusercontent.com"
    });
    expect(mocks.prisma.session.create).toHaveBeenCalled();
  });

  it("returns 401 without a session and 403 for a role mismatch", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue(null);
    const unauthorized = await request(app).get("/api/me/reports").set("Origin", frontend);
    expect(unauthorized.status).toBe(401);

    const forbidden = await request(app)
      .get("/api/me/reports")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("ADMIN"));
    expect(forbidden.status).toBe(403);
  });

  it("rejects suspended sessions on every protected request", async () => {
    const cookie = sessionCookie();
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session-id",
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      csrfHash,
      user: { ...user, accountStatus: "SUSPENDED" }
    });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Origin", frontend)
      .set("Cookie", cookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_FORBIDDEN");
  });
});

describe("report and privacy contract", () => {
  it("returns the same 404 for an unknown or non-owned report code", async () => {
    mocks.prisma.report.findFirst.mockResolvedValue(null);
    const responses = await Promise.all([
      request(app)
        .get("/api/me/reports/LPR-2026-000099")
        .set("Origin", frontend)
        .set("Cookie", sessionCookie("PELAPOR")),
      request(app)
        .get("/api/me/reports/LPR-2026-000002")
        .set("Origin", frontend)
        .set("Cookie", sessionCookie("PELAPOR"))
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(responses[0].body.error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicCode: "LPR-2026-000099", reporterId: user.id }
    }));
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicCode: "LPR-2026-000002", reporterId: user.id }
    }));
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledTimes(2);
  });

  it("TC-13 lists only the signed-in reporter's reports with pagination, status filter, and their status counts", async () => {
    mocks.prisma.report.count.mockResolvedValue(1);
    mocks.prisma.report.findMany.mockResolvedValue([{ ...reportData, status: "REJECTED" }]);
    mocks.prisma.$queryRaw.mockResolvedValue([
      { status: "SUBMITTED", count: 2n },
      { status: "REJECTED", count: 1n }
    ]);

    const response = await request(app)
      .get("/api/me/reports?page=2&limit=1&status=REJECTED")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("PELAPOR"));

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 1, total: 1 });
    expect(response.body.data.map((report: { code: string }) => report.code)).toEqual([reportData.publicCode]);
    expect(response.body.counts).toEqual({
      SUBMITTED: 2,
      VERIFIED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      REJECTED: 1,
      DUPLICATE: 0
    });
    expect(mocks.prisma.report.count).toHaveBeenCalledWith({
      where: { reporterId: user.id, status: "REJECTED" }
    });
    expect(mocks.prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { reporterId: user.id, status: "REJECTED" },
      orderBy: { createdAt: "desc" },
      skip: 1,
      take: 1
    }));
    const statusCountQuery = mocks.prisma.$queryRaw.mock.calls[0];
    expect(statusCountQuery[0].join("")).toContain("WHERE reporter_id = ");
    expect(statusCountQuery[1]).toBe(user.id);
  });

  it("restricts category management to administrators", async () => {
    const [unauthenticated, reporter] = await Promise.all([
      request(app).get("/api/admin/categories").set("Origin", frontend),
      request(app).get("/api/admin/categories")
        .set("Origin", frontend)
        .set("Cookie", sessionCookie("PELAPOR"))
    ]);

    expect(unauthenticated.status).toBe(401);
    expect(reporter.status).toBe(403);
    expect(mocks.prisma.reportCategory.findMany).not.toHaveBeenCalled();
  });

  it("lists notifications only for the signed-in reporter", async () => {
    const notifications = [{
      id: "92222222-2222-4222-8222-222222222222",
      userId: user.id,
      reportId: reportData.id,
      type: "REPORT_STATUS_CHANGED",
      message: "Laporan Anda telah diverifikasi.",
      isRead: false,
      createdAt: new Date("2026-11-03T00:00:00.000Z"),
      report: { publicCode: reportData.publicCode }
    }];
    mocks.prisma.notification.findMany.mockResolvedValue(notifications);

    const response = await request(app)
      .get("/api/me/notifications")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("PELAPOR"));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{
      id: notifications[0].id,
      type: notifications[0].type,
      message: notifications[0].message,
      isRead: false,
      createdAt: notifications[0].createdAt.toISOString(),
      reportCode: reportData.publicCode,
      reportUrl: `/laporan/${reportData.publicCode}`
    }]);
    expect(mocks.prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      include: { report: { select: { publicCode: true } } },
      orderBy: { createdAt: "desc" }
    });
    expect(JSON.stringify(response.body)).not.toContain("email");
  });

  it("marks only the owner's notification as read", async () => {
    const notificationId = "92222222-2222-4222-8222-222222222222";
    const notification = {
      id: notificationId,
      userId: user.id,
      reportId: reportData.id,
      type: "REPORT_STATUS_CHANGED",
      message: "Laporan Anda telah diverifikasi.",
      isRead: true,
      createdAt: new Date("2026-11-03T00:00:00.000Z"),
      report: { publicCode: reportData.publicCode }
    };
    mocks.prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.notification.findFirst.mockResolvedValue(notification);

    const response = await request(app)
      .patch(`/api/me/notifications/${notificationId}/read`)
      .set(mutationHeaders("PELAPOR"));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: notificationId,
      isRead: true,
      reportCode: reportData.publicCode,
      reportUrl: `/laporan/${reportData.publicCode}`
    });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true }
    });
    expect(mocks.prisma.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notificationId, userId: user.id }
    }));
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not reveal notifications owned by another user", async () => {
    const notificationId = "92222222-2222-4222-8222-222222222222";
    mocks.prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.notification.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .patch(`/api/me/notifications/${notificationId}/read`)
      .set(mutationHeaders("PELAPOR"));

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "NOT_FOUND",
      message: "Notifikasi tidak ditemukan"
    });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true }
    });
  });

  it("creates a safe status notification inside the status transaction", async () => {
    let insideTransaction = false;
    mocks.prisma.$transaction.mockImplementationOnce(async (operation: unknown) => {
      expect(typeof operation).toBe("function");
      insideTransaction = true;
      try {
        return await (operation as (tx: typeof mocks.prisma) => unknown)(mocks.prisma);
      } finally {
        insideTransaction = false;
      }
    });
    mocks.prisma.report.findUnique.mockResolvedValue({
      id: reportData.id,
      status: "SUBMITTED",
      reporterId: user.id,
      title: "Lampu jalan mati di depan sekolah",
      reporter: { email: "rani@example.com" }
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "SUBMITTED" }]);
    mocks.prisma.report.updateMany.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { count: 1 };
    });
    mocks.prisma.reportStatusHistory.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { id: "history-id" };
    });
    mocks.prisma.notification.create.mockImplementation(async (args) => {
      expect(insideTransaction).toBe(true);
      return args.data;
    });
    mocks.emailService.sendReportStatusEmail.mockImplementation(async () => {
      expect(insideTransaction).toBe(false);
    });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "REJECTED",
        expectedStatus: "SUBMITTED",
        reason: "Private internal moderation detail"
      });

    expect(response.status).toBe(200);
    expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        reportId: reportData.id,
        type: "REPORT_STATUS_CHANGED",
        message: "Laporan Anda ditolak. Silakan periksa detail laporan untuk informasi lebih lanjut."
      }
    });
    expect(JSON.stringify(mocks.prisma.notification.create.mock.calls[0])).not.toContain("Private internal");
    expect(mocks.emailService.sendReportStatusEmail).toHaveBeenCalledWith({
      to: "rani@example.com",
      reportCode: "LPR-2026-000001",
      reportTitle: "Lampu jalan mati di depan sekolah",
      previousStatus: "SUBMITTED",
      newStatus: "REJECTED",
      message: "Laporan Anda ditolak. Silakan periksa detail laporan untuk informasi lebih lanjut."
    });
  });

  it("aborts the status transaction when its notification cannot be created", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({
      id: reportData.id,
      status: "SUBMITTED",
      reporterId: user.id,
      title: "Lampu jalan mati di depan sekolah",
      reporter: { email: "rani@example.com" }
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "SUBMITTED" }]);
    mocks.prisma.report.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });
    mocks.prisma.notification.create.mockRejectedValue(new Error("Notification write failed"));

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "VERIFIED", expectedStatus: "SUBMITTED" });

    expect(response.status).toBe(500);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.prisma.report.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it("lists active and inactive categories for administrators", async () => {
    const categories = [
      { id: 1, name: "Jalan rusak", slug: "jalan-rusak", isActive: true },
      { id: 2, name: "Kategori lama", slug: "kategori-lama", isActive: false }
    ];
    mocks.prisma.reportCategory.findMany.mockResolvedValue(categories);

    const response = await request(app)
      .get("/api/admin/categories")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("ADMIN"));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(categories);
    expect(mocks.prisma.reportCategory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { id: "asc" }
    }));
    expect(mocks.prisma.reportCategory.findMany).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true }
    }));
  });

  it("creates a category with a unique slug and active state", async () => {
    const category = { id: 7, name: "Fasilitas kota", slug: "fasilitas-kota", isActive: true };
    mocks.prisma.reportCategory.create.mockResolvedValue(category);

    const response = await request(app)
      .post("/api/admin/categories")
      .set(mutationHeaders("ADMIN"))
      .send({ name: category.name, slug: category.slug });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(category);
    expect(mocks.prisma.reportCategory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: category.name, slug: category.slug, isActive: true }
    }));
  });

  it.each([
    [{ name: "AB", slug: "valid-slug" }, "name"],
    [{ name: "Nama valid", slug: "Invalid-Slug" }, "slug"],
    [{ name: "Nama valid", slug: "valid-slug", isActive: "false" }, "isActive"]
  ])("rejects invalid category input %#", async (body, field) => {
    const response = await request(app)
      .post("/api/admin/categories")
      .set(mutationHeaders("ADMIN"))
      .send(body);

    expect(response.status).toBe(422);
    expect(response.body.error.fields).toHaveProperty(field);
    expect(mocks.prisma.reportCategory.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "P2002", meta: { target: ["name"] } }, "name"],
    [{ code: "P2002", meta: { target: ["slug"] } }, "slug"]
  ])("validates duplicate category %s values", async (error, field) => {
    mocks.prisma.reportCategory.create.mockRejectedValue(error);

    const response = await request(app)
      .post("/api/admin/categories")
      .set(mutationHeaders("ADMIN"))
      .send({ name: "Fasilitas kota", slug: "fasilitas-kota" });

    expect(response.status).toBe(422);
    expect(response.body.error.fields).toHaveProperty(field);
  });

  it("deactivates a category without deleting it", async () => {
    const category = { id: 3, name: "Kategori lama", slug: "kategori-lama", isActive: false };
    mocks.prisma.reportCategory.findUnique.mockResolvedValue({ id: category.id });
    mocks.prisma.reportCategory.update.mockResolvedValue(category);

    const response = await request(app)
      .patch(`/api/admin/categories/${category.id}`)
      .set(mutationHeaders("ADMIN"))
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(category);
    expect(mocks.prisma.reportCategory.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: category.id },
      data: { isActive: false }
    }));
  });

  it("keeps an existing report category reference while preventing new reports with inactive categories", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue(null);

    const response = await reportSubmission()
      .attach("photos", png, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.categoryId).toBe("Kategori tidak tersedia");
    expect(mocks.prisma.reportCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 1, isActive: true },
      select: { id: true }
    });
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
    expect(mocks.prisma.reportCategory.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate category names or slugs when updating", async () => {
    mocks.prisma.reportCategory.findUnique.mockResolvedValue({ id: 3 });
    mocks.prisma.reportCategory.update.mockRejectedValue({
      code: "P2002",
      meta: { target: ["slug"] }
    });

    const response = await request(app)
      .patch("/api/admin/categories/3")
      .set(mutationHeaders("ADMIN"))
      .send({ slug: "used-slug" });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.slug).toBeDefined();
  });

  it("returns 404 when updating an unknown category", async () => {
    mocks.prisma.reportCategory.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .patch("/api/admin/categories/999")
      .set(mutationHeaders("ADMIN"))
      .send({ isActive: false });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(mocks.prisma.reportCategory.update).not.toHaveBeenCalled();
  });

  it("TC-20 returns the owner's complete status timeline, including rejection reasons", async () => {
    const rejectedAt = new Date("2026-10-26T01:00:00.000Z");
    mocks.prisma.report.findFirst.mockResolvedValue({
      ...reportData,
      status: "REJECTED",
      statusHistories: [{
        fromStatus: "SUBMITTED",
        toStatus: "REJECTED",
        reason: "Foto bukti belum jelas",
        createdAt: rejectedAt,
        user: { role: "ADMIN" }
      }]
    });

    const response = await request(app)
      .get("/api/me/reports/LPR-2026-000001")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("PELAPOR"));

    expect(response.status).toBe(200);
    expect(response.body.data.timeline).toEqual([{
      fromStatus: "SUBMITTED",
      toStatus: "REJECTED",
      reason: "Foto bukti belum jelas",
      createdAt: rejectedAt.toISOString(),
      actorLabel: "Administrator platform"
    }]);
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicCode: "LPR-2026-000001", reporterId: user.id }
    }));
  });

  it("does not expose reporter identity or private rejection reasons publicly", async () => {
    mocks.prisma.report.findFirst.mockResolvedValue({
      ...reportData,
      status: "VERIFIED",
      statusHistories: [
        { fromStatus: null, toStatus: "SUBMITTED", createdAt: new Date(), reason: null },
        { fromStatus: "SUBMITTED", toStatus: "REJECTED", createdAt: new Date(), reason: "private reason" },
        { fromStatus: "REJECTED", toStatus: "SUBMITTED", createdAt: new Date(), reason: "private correction" },
        { fromStatus: "SUBMITTED", toStatus: "VERIFIED", createdAt: new Date(), reason: null }
      ],
      reporter: { name: "Rani", email: "private@example.test" }
    });
    const response = await request(app)
      .get("/api/reports/LPR-2026-000001")
      .set("Origin", frontend);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(user.id);
    expect(JSON.stringify(response.body)).not.toContain("private@example.test");
    expect(JSON.stringify(response.body)).not.toContain("private reason");
    expect(response.body.data.timeline).toHaveLength(2);
    expect(response.body.data.timeline[0].actorLabel).toBe("Administrator platform");
  });

  it("TC-23 serves signed evidence only when the report is public or the viewer is authorized", async () => {
    const id = "223c0918-5f83-4a78-88da-110d04478f44";
    const key = "laporinaja/signed-photo";
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(image, { status: 200, headers: { "content-type": "image/png" } })
    ));
    const signedUrl = mediaUrl(id);
    mocks.prisma.reportEvidence.findUnique.mockResolvedValue({
      id,
      storageKey: key,
      mimeType: "image/png",
      report: { reporterId: user.id, status: "SUBMITTED", isHidden: false }
    });
    const privateFile = await request(app).get(signedUrl).set("Origin", frontend);
    expect(privateFile.status).toBe(404);
    expect(privateFile.body.error.code).toBe("NOT_FOUND");

    mocks.prisma.reportEvidence.findUnique.mockResolvedValue({
      id,
      storageKey: key,
      mimeType: "image/png",
      report: { reporterId: user.id, status: "VERIFIED", isHidden: false }
    });
    const publicFile = await request(app).get(signedUrl).set("Origin", frontend);
    expect(publicFile.status).toBe(200);
    expect(publicFile.headers["content-type"]).toContain("image/png");
    expect(mocks.cloudinary.url).toHaveBeenCalledWith(key, expect.objectContaining({
      type: "authenticated",
      sign_url: true
    }));
  });

  it("TC-18 returns 409 when expectedStatus does not match the current status", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "IN_PROGRESS" });
    const conflict = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "VERIFIED", expectedStatus: "SUBMITTED" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("STATUS_CONFLICT");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("TC-18 returns 422 for a transition that is not allowed", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "IN_PROGRESS" });
    const invalid = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "SUBMITTED", expectedStatus: "IN_PROGRESS" });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("INVALID_TRANSITION");
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["SUBMITTED", "VERIFIED"],
    ["SUBMITTED", "REJECTED"],
    ["VERIFIED", "IN_PROGRESS"],
    ["VERIFIED", "REJECTED"],
    ["REJECTED", "SUBMITTED"]
  ])("TC-15 allows the MVP transition %s to %s", async (fromStatus, toStatus) => {
    const reason = toStatus === "REJECTED" || fromStatus === "REJECTED"
      ? "Alasan koreksi valid"
      : undefined;
    const historyId = "9ed1209d-9b25-47b6-b88b-d7d33120f481";
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: fromStatus });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: fromStatus }]);
    mocks.prisma.report.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: historyId });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus, expectedStatus: fromStatus, ...(reason ? { reason } : {}) });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      code: "LPR-2026-000001",
      status: toStatus,
      historyId
    });
    expect(mocks.prisma.report.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: reportData.id, status: fromStatus },
      data: expect.objectContaining({ status: toStatus })
    }));
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reportId: reportData.id,
        fromStatus,
        toStatus,
        changedBy: user.id,
        reason: reason ?? null
      })
    }));
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it.each([
    ["SUBMITTED", "IN_PROGRESS"],
    ["IN_PROGRESS", "DUPLICATE"]
  ])("TC-15 does not enable the out-of-scope transition %s to %s", async (fromStatus, toStatus) => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: fromStatus });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus,
        expectedStatus: fromStatus,
        reason: "Alasan transisi valid",
        ...(toStatus === "DUPLICATE" ? { duplicateOfCode: "LPR-2026-000002" } : {})
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, "Alasan 9"])(
    "FR-024 requires a reason of at least 10 characters to reopen a resolved report (%s)",
    async (reason) => {
      mocks.prisma.report.findUnique.mockResolvedValue({
        id: reportData.id,
        status: "RESOLVED"
      });

      const response = await request(app)
        .post("/api/admin/reports/LPR-2026-000001/status")
        .set(mutationHeaders("ADMIN"))
        .send({
          toStatus: "IN_PROGRESS",
          expectedStatus: "RESOLVED",
          ...(reason === undefined ? {} : { reason })
        });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields.reason).toBe("Alasan minimal 10 karakter");
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
      expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
      expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
    }
  );

  it("FR-024 reopens within 14 days with authenticated actor and append-only history", async () => {
    const historyId = "9ed1209d-9b25-47b6-b88b-d7d33120f481";
    const reason = "Masalah muncul kembali setelah perbaikan";
    const resolvedAt = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    let insideTransaction = false;
    mocks.prisma.$transaction.mockImplementationOnce(async (operation: unknown) => {
      insideTransaction = true;
      try {
        return await (operation as (tx: typeof mocks.prisma) => unknown)(mocks.prisma);
      } finally {
        insideTransaction = false;
      }
    });
    mocks.prisma.report.findUnique.mockResolvedValue({
      id: reportData.id,
      status: "RESOLVED",
      reporterId: user.id,
      title: reportData.title,
      reporter: { email: "rani@example.com" }
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "RESOLVED", resolvedAt }]);
    mocks.prisma.report.updateMany.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { count: 1 };
    });
    mocks.prisma.reportStatusHistory.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { id: historyId };
    });
    mocks.prisma.notification.create.mockImplementation(async (args) => {
      expect(insideTransaction).toBe(true);
      return args.data;
    });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "IN_PROGRESS",
        expectedStatus: "RESOLVED",
        reason
      });

    expect(response.status).toBe(200);
    expect(mocks.prisma.report.updateMany).toHaveBeenCalledWith({
      where: { id: reportData.id, status: "RESOLVED" },
      data: { status: "IN_PROGRESS", resolvedAt: null }
    });
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledWith({
      data: {
        reportId: reportData.id,
        fromStatus: "RESOLVED",
        toStatus: "IN_PROGRESS",
        changedBy: user.id,
        reason
      },
      select: { id: true }
    });
    expect(mocks.prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        reportId: reportData.id,
        type: "REPORT_STATUS_CHANGED",
        message: "Laporan Anda sedang ditindaklanjuti."
      }
    });
    expect(mocks.prisma.reportEvidence.create).not.toHaveBeenCalled();
    expect(mocks.prisma.reportEvidence.createMany).not.toHaveBeenCalled();
  });

  it("FR-024 rejects reopening more than 14 days after resolution without changing report or history", async () => {
    const resolvedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    mocks.prisma.report.findUnique.mockResolvedValue({
      id: reportData.id,
      status: "RESOLVED"
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "RESOLVED", resolvedAt }]);

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "IN_PROGRESS",
        expectedStatus: "RESOLVED",
        reason: "Masalah muncul kembali setelah perbaikan"
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields.toStatus).toContain("14 hari");
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
  });

  it.each([
    ["SUBMITTED", "REJECTED", ""],
    ["SUBMITTED", "REJECTED", "123456789"],
    ["SUBMITTED", "REJECTED", "1234567890"],
    ["REJECTED", "SUBMITTED", ""],
    ["REJECTED", "SUBMITTED", "123456789"],
    ["REJECTED", "SUBMITTED", "1234567890"]
  ])("TC-16 applies the 10-character reason rule for %s to %s", async (fromStatus, toStatus, reason) => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: fromStatus });
    const validReason = reason.length >= 10;
    if (validReason) {
      mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: fromStatus }]);
      mocks.prisma.report.updateMany.mockResolvedValue({ count: 1 });
      mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });
    }

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus, expectedStatus: fromStatus, reason });

    expect(response.status).toBe(validReason ? 200 : 422);
    if (!validReason) {
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
    }
  });

  it("TC-17 records the authenticated administrator as the status-change actor", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "SUBMITTED" });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "SUBMITTED" }]);
    mocks.prisma.report.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "VERIFIED", expectedStatus: "SUBMITTED" });

    expect(response.status).toBe(200);
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ changedBy: user.id })
    }));
  });

  it("TC-19 writes status and history inside one transaction", async () => {
    let insideTransaction = false;
    mocks.prisma.$transaction.mockImplementationOnce(async (operation: unknown) => {
      expect(typeof operation).toBe("function");
      insideTransaction = true;
      try {
        return await (operation as (tx: typeof mocks.prisma) => unknown)(mocks.prisma);
      } finally {
        insideTransaction = false;
      }
    });
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "SUBMITTED" });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "SUBMITTED" }]);
    mocks.prisma.report.updateMany.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { count: 1 };
    });
    mocks.prisma.reportStatusHistory.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { id: "history-id" };
    });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "VERIFIED", expectedStatus: "SUBMITTED" });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.report.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it("TC-18 catches a status change that races with the request", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "SUBMITTED" });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "VERIFIED" }]);

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "REJECTED", expectedStatus: "SUBMITTED", reason: "Alasan penolakan valid" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STATUS_CONFLICT");
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
  });

  it.each([
    ["SUBMITTED", "VERIFIED"],
    ["SUBMITTED", "IN_PROGRESS"],
    ["SUBMITTED", "RESOLVED"],
    ["VERIFIED", "VERIFIED"],
    ["VERIFIED", "IN_PROGRESS"],
    ["VERIFIED", "RESOLVED"]
  ])("FR-019 marks %s as a duplicate of a %s report atomically", async (sourceStatus, targetStatus) => {
    const targetId = "228f42a4-4d7b-4ce0-8459-6d3b70a43002";
    const historyId = "9ed1209d-9b25-47b6-b88b-d7d33120f481";
    let insideTransaction = false;
    mocks.prisma.$transaction.mockImplementationOnce(async (operation: unknown) => {
      expect(typeof operation).toBe("function");
      insideTransaction = true;
      try {
        return await (operation as (tx: typeof mocks.prisma) => unknown)(mocks.prisma);
      } finally {
        insideTransaction = false;
      }
    });
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: sourceStatus });
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ status: sourceStatus }])
      .mockResolvedValueOnce([{ id: targetId, status: targetStatus }]);
    mocks.prisma.report.updateMany.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { count: 1 };
    });
    mocks.prisma.reportStatusHistory.create.mockImplementation(async () => {
      expect(insideTransaction).toBe(true);
      return { id: historyId };
    });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "DUPLICATE",
        expectedStatus: sourceStatus,
        duplicateOfCode: "LPR-2026-000002",
        reason: "Laporan yang sama sudah tercatat"
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      code: "LPR-2026-000001",
      status: "DUPLICATE",
      historyId
    });
    expect(mocks.prisma.report.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: reportData.id, status: sourceStatus },
      data: expect.objectContaining({ status: "DUPLICATE", duplicateOfReportId: targetId })
    }));
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reportId: reportData.id,
        fromStatus: sourceStatus,
        toStatus: "DUPLICATE",
        changedBy: user.id,
        reason: "Laporan yang sama sudah tercatat"
      })
    }));
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it.each([
    ["SUBMITTED", "SUBMITTED"],
    ["SUBMITTED", "REJECTED"],
    ["SUBMITTED", "DUPLICATE"],
    ["SUBMITTED", "self"]
  ])("FR-019 rejects an invalid %s duplicate target (%s)", async (sourceStatus, targetStatus) => {
    const sourceId = reportData.id;
    const targetId = targetStatus === "self" ? sourceId : "228f42a4-4d7b-4ce0-8459-6d3b70a43002";
    mocks.prisma.report.findUnique.mockResolvedValue({ id: sourceId, status: sourceStatus });
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ status: sourceStatus }])
      .mockResolvedValueOnce(targetStatus === "self"
        ? [{ id: targetId, status: "VERIFIED" }]
        : [{ id: targetId, status: targetStatus }]);

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "DUPLICATE",
        expectedStatus: sourceStatus,
        duplicateOfCode: "LPR-2026-000002"
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields.duplicateOfCode).toBeDefined();
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
  });

  it("FR-019 rejects a nonexistent primary report without changing status or history", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "VERIFIED" });
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ status: "VERIFIED" }])
      .mockResolvedValueOnce([]);

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "DUPLICATE",
        expectedStatus: "VERIFIED",
        duplicateOfCode: "LPR-2026-000099"
      });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.duplicateOfCode).toBeDefined();
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
  });

  it("FR-019 requires duplicateOfCode only when transitioning to DUPLICATE", async () => {
    const missing = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "DUPLICATE", expectedStatus: "SUBMITTED" });
    const malformed = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "DUPLICATE",
        expectedStatus: "SUBMITTED",
        duplicateOfCode: "not-a-report-code"
      });
    const unexpected = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "VERIFIED",
        expectedStatus: "SUBMITTED",
        duplicateOfCode: "LPR-2026-000002"
      });

    expect(missing.status).toBe(422);
    expect(missing.body.error.fields.duplicateOfCode).toBeDefined();
    expect(malformed.status).toBe(422);
    expect(malformed.body.error.fields.duplicateOfCode).toBeDefined();
    expect(unexpected.status).toBe(422);
    expect(unexpected.body.error.fields.duplicateOfCode).toBeDefined();
    expect(mocks.prisma.report.findUnique).not.toHaveBeenCalled();
  });

  it("FR-019 returns 409 when expectedStatus is stale for a duplicate transition", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status: "VERIFIED" });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({
        toStatus: "DUPLICATE",
        expectedStatus: "SUBMITTED",
        duplicateOfCode: "LPR-2026-000002"
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STATUS_CONFLICT");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("TC-20 does not expose status-history edit or delete endpoints", async () => {
    const historyId = "9ed1209d-9b25-47b6-b88b-d7d33120f481";
    const [editStatus, deleteStatus, editHistory, deleteHistory] = await Promise.all([
      request(app).put("/api/admin/reports/LPR-2026-000001/status").set(mutationHeaders("ADMIN")),
      request(app).delete("/api/admin/reports/LPR-2026-000001/status").set(mutationHeaders("ADMIN")),
      request(app).put(`/api/admin/reports/LPR-2026-000001/status-history/${historyId}`).set(mutationHeaders("ADMIN")),
      request(app).delete(`/api/admin/reports/LPR-2026-000001/status-history/${historyId}`).set(mutationHeaders("ADMIN"))
    ]);

    expect([editStatus.status, deleteStatus.status, editHistory.status, deleteHistory.status])
      .toEqual([404, 404, 404, 404]);
    expect(mocks.prisma.reportStatusHistory.create).not.toHaveBeenCalled();
  });

  it("returns the same 200 result for a retried submissionKey", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue({
      publicCode: "LPR-2026-000021",
      status: "SUBMITTED"
    });
    const response = await request(app)
      .post("/api/reports")
      .set(mutationHeaders("PELAPOR"))
      .field("categoryId", "1")
      .field("title", "Lampu jalan mati dekat taman")
      .field("description", "Lampu jalan di dekat taman tidak menyala selama tiga malam.")
      .field("city", "Kota")
      .field("district", "Kecamatan")
      .field("village", "Kelurahan")
      .field("locationDetail", "Dekat taman utama")
      .field("submissionKey", "7f3e2cee-c90c-4a54-b12a-5a9c65a13590")
      .attach("photos", Buffer.from("not inspected because idempotency key already exists"), {
        filename: "photo.png",
        contentType: "image/png"
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ code: "LPR-2026-000021", status: "SUBMITTED" });
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("creates a report, initial history, and image metadata as one database transaction", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    mocks.prisma.report.count.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ value: 21n }]);
    mocks.prisma.report.create.mockResolvedValue({
      id: reportData.id,
      publicCode: "LPR-2026-000021",
      status: "SUBMITTED"
    });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });
    mocks.prisma.reportEvidence.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .post("/api/reports")
      .set(mutationHeaders("PELAPOR"))
      .field("categoryId", "1")
      .field("title", "Lampu jalan mati dekat taman")
      .field("description", "Lampu jalan di dekat taman tidak menyala selama tiga malam.")
      .field("city", "Kota")
      .field("district", "Kecamatan")
      .field("village", "Kelurahan")
      .field("locationDetail", "Dekat taman utama")
      .field("submissionKey", "7f3e2cee-c90c-4a54-b12a-5a9c65a13590")
      .attach("photos", png, { filename: "photo.png", contentType: "image/png" });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ code: "LPR-2026-000021", status: "SUBMITTED" });
    expect(mocks.prisma.reportStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fromStatus: null,
        toStatus: "SUBMITTED",
        changedBy: user.id
      })
    }));
    expect(mocks.prisma.reportEvidence.createMany).toHaveBeenCalled();
    expect(mocks.cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ type: "authenticated", folder: "laporinaja-test" }),
      expect.any(Function)
    );
    expect(mocks.prisma.$transaction).toHaveBeenCalled();
  });

  it("TC-09 rejects invalid image bytes before inserting a report", async () => {
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    mocks.prisma.report.count.mockResolvedValue(0);
    const response = await request(app)
      .post("/api/reports")
      .set(mutationHeaders("PELAPOR"))
      .field("categoryId", "1")
      .field("title", "Lampu jalan mati dekat taman")
      .field("description", "Lampu jalan di dekat taman tidak menyala selama tiga malam.")
      .field("city", "Kota")
      .field("district", "Kecamatan")
      .field("village", "Kelurahan")
      .field("locationDetail", "Dekat taman utama")
      .field("submissionKey", "7f3e2cee-c90c-4a54-b12a-5a9c65a13590")
      .attach("photos", Buffer.from("not an image"), { filename: "photo.png", contentType: "image/png" });
    expect(response.status).toBe(422);
    expect(response.body.error.fields.photos).toBeDefined();
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("TC-09 requires a photo and rejects a fourth photo", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();

    const missingPhotoResponse = await reportSubmission();
    expect(missingPhotoResponse.status).toBe(422);
    expect(missingPhotoResponse.body.error.fields.photos).toBe("Unggah 1 sampai 3 foto");

    const tooManyPhotos = reportSubmission()
      .attach("photos", png, { filename: "one.png", contentType: "image/png" })
      .attach("photos", png, { filename: "two.png", contentType: "image/png" })
      .attach("photos", png, { filename: "three.png", contentType: "image/png" })
      .attach("photos", png, { filename: "four.png", contentType: "image/png" });
    const tooManyResponse = await tooManyPhotos;
    expect(tooManyResponse.status).toBe(422);
    expect(tooManyResponse.body.error.fields.photos).toBe("Unggah maksimal 3 foto");
    expect(mocks.cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("TC-09 rejects a photo larger than 5 MB", async () => {
    const oversizedPhoto = Buffer.alloc(5 * 1024 * 1024 + 1);
    const response = await reportSubmission()
      .attach("photos", oversizedPhoto, { filename: "large.png", contentType: "image/png" });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.photos).toBe("Ukuran maksimum setiap foto adalah 5 MB");
    expect(mocks.cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("TC-09 rejects a valid image when its declared MIME type does not match its bytes", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    const response = await reportSubmission()
      .attach("photos", png, { filename: "photo.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.photos).toBe("MIME file tidak sesuai dengan isi gambar");
    expect(mocks.cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("TC-08 accepts three photos, strips EXIF metadata, and uses a random storage key", async () => {
    const jpeg = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).jpeg()
      .withExif({ IFD0: { Artist: "private metadata" } })
      .toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    mocks.prisma.report.count.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ value: 21n }]);
    mocks.prisma.report.create.mockResolvedValue({
      id: reportData.id,
      publicCode: "LPR-2026-000021",
      status: "SUBMITTED"
    });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });
    mocks.prisma.reportEvidence.createMany.mockResolvedValue({ count: 3 });
    let uploadedBuffer: Buffer | undefined;
    let uploadedOptions: { public_id: string } | undefined;
    mocks.cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({
      end: (buffer: Buffer) => {
        uploadedBuffer = Buffer.from(buffer);
        uploadedOptions = options;
        callback(undefined, {
          public_id: `${options.folder}/${options.public_id}`,
          secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/${options.public_id}`,
          format: "jpg",
          bytes: buffer.length
        });
      }
    }));

    const response = await reportSubmission()
      .attach("photos", jpeg, { filename: "one.jpg", contentType: "image/jpeg" })
      .attach("photos", jpeg, { filename: "two.jpg", contentType: "image/jpeg" })
      .attach("photos", jpeg, { filename: "three.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(201);
    expect(uploadedOptions?.public_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(mocks.cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    expect(uploadedBuffer).toBeDefined();
    const uploadedMetadata = await sharp(uploadedBuffer!).metadata();
    expect(uploadedMetadata.format).toBe("jpeg");
    expect(uploadedMetadata.exif).toBeUndefined();
  });

  it("TC-09 reports Cloudinary upload failure and removes any earlier uploaded photo", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    let uploadCount = 0;
    let firstStorageKey = "";
    mocks.cloudinary.uploader.upload_stream.mockImplementation((options, callback) => ({
      end: (buffer: Buffer) => {
        uploadCount += 1;
        if (uploadCount === 2) {
          callback(new Error("Cloudinary unavailable"));
          return;
        }
        firstStorageKey = `${options.folder}/${options.public_id}`;
        callback(undefined, {
          public_id: firstStorageKey,
          secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/${firstStorageKey}`,
          format: "png",
          bytes: buffer.length
        });
      }
    }));

    const response = await reportSubmission()
      .attach("photos", png, { filename: "one.png", contentType: "image/png" })
      .attach("photos", png, { filename: "two.png", contentType: "image/png" });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("UPLOAD_FAILED");
    expect(mocks.cloudinary.uploader.destroy).toHaveBeenCalledWith(
      firstStorageKey,
      expect.objectContaining({ type: "authenticated" })
    );
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });

  it("removes uploaded photos when the report database transaction fails", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue(null);
    mocks.prisma.reportCategory.findFirst.mockResolvedValue({ id: 1 });
    mocks.prisma.report.count.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ value: 21n }]);
    mocks.prisma.report.create.mockResolvedValue({
      id: reportData.id,
      publicCode: "LPR-2026-000021",
      status: "SUBMITTED"
    });
    mocks.prisma.reportEvidence.createMany.mockRejectedValue(new Error("Database unavailable"));

    const response = await reportSubmission()
      .attach("photos", png, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(mocks.cloudinary.uploader.destroy).toHaveBeenCalledWith(
      expect.stringMatching(/^laporinaja-test\/[0-9a-f-]{36}$/i),
      expect.objectContaining({ type: "authenticated" })
    );
  });

  it("requires a visual proof or a 30-character resolution explanation", async () => {
    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", "Pekerjaan perbaikan sudah selesai")
      .field("isResolutionNote", "true");
    expect(response.status).toBe(422);
    expect(response.body.error.fields.resolutionExplanation).toBeDefined();
    expect(mocks.prisma.reportFollowUp.create).not.toHaveBeenCalled();
  });

  it.each([
    ["VERIFIED", 10],
    ["VERIFIED", 500],
    ["IN_PROGRESS", 10],
    ["IN_PROGRESS", 500]
  ])("TC-21 appends a %s follow-up note of %i characters", async (status, length) => {
    const note = "x".repeat(length);
    const followUpId = "5ea3cd77-8123-4702-94ea-1f8a1e480ad1";
    const createdAt = new Date("2026-10-26T00:00:00.000Z");
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status }]);
    mocks.prisma.reportFollowUp.create.mockResolvedValue({
      id: followUpId,
      note,
      createdAt
    });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", note)
      .field("isResolutionNote", "false");

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      id: followUpId,
      note,
      createdAt: createdAt.toISOString()
    });
    expect(mocks.prisma.reportFollowUp.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reportId: reportData.id,
        createdBy: user.id,
        note,
        isResolutionNote: false
      })
    }));
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("TC-21 does not expose follow-up note edit or delete operations", async () => {
    const followUpId = "5ea3cd77-8123-4702-94ea-1f8a1e480ad1";
    const url = `/api/admin/reports/LPR-2026-000001/follow-ups/${followUpId}`;

    const [edit, remove] = await Promise.all([
      request(app).put(url).set(mutationHeaders("ADMIN")).send({ note: "Catatan koreksi terbaru" }),
      request(app).delete(url).set(mutationHeaders("ADMIN"))
    ]);

    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(mocks.prisma.reportFollowUp.create).not.toHaveBeenCalled();
  });

  it.each([
    ["shorter than 10 characters", "123456789"],
    ["longer than 500 characters", "x".repeat(501)]
  ])("TC-21 rejects a follow-up note %s", async (_label, note) => {
    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", note)
      .field("isResolutionNote", "false");

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.report.findUnique).not.toHaveBeenCalled();
  });

  it.each(["SUBMITTED", "RESOLVED"])("TC-21 rejects follow-up notes in %s status", async (status) => {
    mocks.prisma.report.findUnique.mockResolvedValue({ id: reportData.id, status });

    const response = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", "Catatan perbaikan baru")
      .field("isResolutionNote", "false");

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
    expect(mocks.prisma.reportFollowUp.create).not.toHaveBeenCalled();
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("TC-22 leaves a report unresolved when proof upload fails", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique
      .mockResolvedValueOnce({ id: reportData.id, status: "IN_PROGRESS" })
      .mockResolvedValueOnce({ id: reportData.id, status: "IN_PROGRESS" });
    mocks.cloudinary.uploader.upload_stream.mockImplementationOnce((_options, callback) => ({
      end: () => callback(new Error("Cloudinary unavailable"), undefined)
    }));

    const upload = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", "Perbaikan telah selesai dilakukan")
      .field("isResolutionNote", "true")
      .attach("photos", png, { filename: "proof.png", contentType: "image/png" });

    expect(upload.status).toBe(502);
    expect(upload.body.error.code).toBe("UPLOAD_FAILED");
    expect(mocks.prisma.reportFollowUp.create).not.toHaveBeenCalled();
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();

    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "IN_PROGRESS" }]);
    const resolve = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "RESOLVED", expectedStatus: "IN_PROGRESS" });

    expect(resolve.status).toBe(422);
    expect(resolve.body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.report.updateMany).not.toHaveBeenCalled();
  });

  it("returns public statistics with enum counts and a zero-safe completion percentage", async () => {
    mocks.prisma.report.count.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const response = await request(app).get("/api/stats/public").set("Origin", frontend);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      total: 0,
      byStatus: {
        SUBMITTED: 0, VERIFIED: 0, IN_PROGRESS: 0,
        RESOLVED: 0, REJECTED: 0, DUPLICATE: 0
      },
      completionRate: 0,
      label: "Data demonstrasi"
    });
    expect(response.body.data.asOf).toMatch(/Z$/);
  });

  it("calculates administrator metrics using the PRD denominators", async () => {
    mocks.prisma.report.count.mockResolvedValue(8);
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([
        { status: "SUBMITTED", count: 2n },
        { status: "VERIFIED", count: 2n },
        { status: "IN_PROGRESS", count: 1n },
        { status: "RESOLVED", count: 1n },
        { status: "REJECTED", count: 1n },
        { status: "DUPLICATE", count: 1n }
      ])
      .mockResolvedValueOnce([{ eligible: 3n, covered: 2n }])
      .mockResolvedValueOnce([{ resolved: 1n, withProof: 1n }]);
    mocks.prisma.reportStatusHistory.findMany.mockResolvedValue([{
      reportId: reportData.id,
      createdAt: new Date("2026-10-26T00:00:10.000Z"),
      report: { createdAt: new Date("2026-10-26T00:00:00.000Z") }
    }]);

    const response = await request(app)
      .get("/api/admin/stats")
      .set("Origin", frontend)
      .set("Cookie", sessionCookie("ADMIN"));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      total: 8,
      submissions: 8,
      verificationRate: 50,
      followUpCoverage: 66.67,
      averageTimeToVerifiedMs: 10_000,
      resolvedWithProofRate: 100
    });
    expect(response.body.data.byStatus.DUPLICATE).toBe(1);
  });

  it.each([
    ["with photo evidence", true],
    ["with a text explanation", false]
  ])("TC-22 supports resolving a report %s", async (_label, withPhoto) => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" }
    }).png().toBuffer();
    mocks.prisma.report.findUnique.mockResolvedValue({
      id: reportData.id,
      status: "IN_PROGRESS"
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "IN_PROGRESS" }]);
    mocks.prisma.reportFollowUp.create.mockResolvedValue({
      id: "5ea3cd77-8123-4702-94ea-1f8a1e480ad1",
      note: "Perbaikan telah selesai dilakukan",
      isResolutionNote: true,
      resolutionExplanation: withPhoto ? null : "Petugas mengganti lampu dan menguji nyala kembali.",
      createdAt: new Date("2026-10-26T00:00:00.000Z")
    });
    mocks.prisma.reportEvidence.createMany.mockResolvedValue({ count: withPhoto ? 1 : 0 });

    let followUpRequest = request(app)
      .post("/api/admin/reports/LPR-2026-000001/follow-ups")
      .set(mutationHeaders("ADMIN"))
      .field("note", "Perbaikan telah selesai dilakukan")
      .field("isResolutionNote", "true");
    if (withPhoto) {
      followUpRequest = followUpRequest.attach("photos", png, {
        filename: "proof.png",
        contentType: "image/png"
      });
    } else {
      followUpRequest = followUpRequest.field(
        "resolutionExplanation",
        "Petugas mengganti lampu dan menguji nyala kembali."
      );
    }
    const followUp = await followUpRequest;
    expect(followUp.status).toBe(201);
    expect(followUp.body.data).toEqual({
      id: "5ea3cd77-8123-4702-94ea-1f8a1e480ad1",
      note: "Perbaikan telah selesai dilakukan",
      createdAt: "2026-10-26T00:00:00.000Z"
    });

    mocks.prisma.reportFollowUp.findFirst.mockResolvedValue({
      id: "5ea3cd77-8123-4702-94ea-1f8a1e480ad1",
      resolutionExplanation: withPhoto ? null : "Petugas mengganti lampu dan menguji nyala kembali.",
      evidences: withPhoto ? [{ id: "evidence-id" }] : []
    });
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ status: "IN_PROGRESS" }]);
    mocks.prisma.report.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.reportStatusHistory.create.mockResolvedValue({ id: "history-id" });
    const resolved = await request(app)
      .post("/api/admin/reports/LPR-2026-000001/status")
      .set(mutationHeaders("ADMIN"))
      .send({ toStatus: "RESOLVED", expectedStatus: "IN_PROGRESS" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toEqual({
      code: "LPR-2026-000001",
      status: "RESOLVED",
      historyId: "history-id"
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalled();
  });

  it("rate-limits repeated login attempts with a contract error envelope", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      request(app)
        .post("/api/auth/login")
        .set("Origin", frontend)
        .send({ email: "nobody@example.test", password: "password123" })
    ));
    const limited = responses.find((response) => response.status === 429);
    expect(limited).toBeDefined();
    expect(limited?.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("public report catalog (LAP-9)", () => {
  it("TC-12 lists only public, non-hidden reports with filters and capped pagination", async () => {
    mocks.prisma.report.count.mockResolvedValue(1);
    mocks.prisma.report.findMany.mockResolvedValue([reportData]);

    const response = await request(app)
      .get("/api/reports?category=lampu-jalan&status=VERIFIED&district=Kecamatan&village=Kelurahan&page=2")
      .set("Origin", frontend);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 12, total: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      code: reportData.publicCode,
      title: reportData.title,
      status: reportData.status,
      category: { slug: "lampu-jalan" },
      thumbnailUrl: null
    });
    expect(JSON.stringify(response.body)).not.toContain(user.id);
    expect(mocks.prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isHidden: false,
        status: { in: ["VERIFIED"] },
        category: { slug: "lampu-jalan" },
        district: "Kecamatan",
        village: "Kelurahan"
      },
      orderBy: { createdAt: "desc" },
      skip: 12,
      take: 12
    }));

    mocks.prisma.report.findMany.mockClear();
    const capped = await request(app).get("/api/reports?limit=50").set("Origin", frontend);
    expect(capped.status).toBe(200);
    expect(mocks.prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));

    const tooLarge = await request(app).get("/api/reports?limit=51").set("Origin", frontend);
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error.code).toBe("BAD_REQUEST");
  });

  it("TC-12 rejects non-public status filters so private reports never leak into the list", async () => {
    for (const status of ["SUBMITTED", "REJECTED"]) {
      const response = await request(app)
        .get(`/api/reports?status=${status}`)
        .set("Origin", frontend);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    }
    expect(mocks.prisma.report.findMany).not.toHaveBeenCalled();
  });

  it("FR-020 searches public reports and composes q with the existing filters and pagination", async () => {
    mocks.prisma.report.count.mockResolvedValue(1);
    mocks.prisma.report.findMany.mockResolvedValue([reportData]);
    const query = "lampu jalan";

    const response = await request(app)
      .get("/api/reports")
      .query({
        q: ` ${query} `,
        category: "lampu-jalan",
        status: "IN_PROGRESS",
        district: "Kecamatan",
        village: "Kelurahan",
        page: "2",
        limit: "5"
      })
      .set("Origin", frontend);

    const searchWhere = {
      isHidden: false,
      status: { in: ["IN_PROGRESS"] },
      OR: [
        { publicCode: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { district: { contains: query, mode: "insensitive" } },
        { village: { contains: query, mode: "insensitive" } },
        { locationDetail: { contains: query, mode: "insensitive" } },
        { category: { name: { contains: query, mode: "insensitive" } } }
      ],
      category: { slug: "lampu-jalan" },
      district: "Kecamatan",
      village: "Kelurahan"
    };

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 5, total: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(mocks.prisma.report.count).toHaveBeenCalledWith({ where: searchWhere });
    expect(mocks.prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: searchWhere,
      orderBy: { createdAt: "desc" },
      skip: 5,
      take: 5
    }));
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["too long", "x".repeat(101)],
    ["repeated", ["first", "second"]]
  ])("FR-020 rejects an invalid %s search query", async (_label, q) => {
    const response = await request(app)
      .get("/api/reports")
      .query({ q })
      .set("Origin", frontend);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
    expect(mocks.prisma.report.count).not.toHaveBeenCalled();
    expect(mocks.prisma.report.findMany).not.toHaveBeenCalled();
  });

  it("FR-020 safely returns an empty result without exposing hidden or private reports", async () => {
    mocks.prisma.report.count.mockResolvedValue(0);
    mocks.prisma.report.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/reports?q=not-found")
      .set("Origin", frontend);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toEqual({ page: 1, limit: 12, total: 0 });
    expect(mocks.prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isHidden: false,
        status: { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED", "DUPLICATE"] },
        OR: expect.any(Array)
      })
    }));
  });

  it("TC-20 returns timeline, notes, and signed evidence without reporter or individual admin identity", async () => {
    const photoId = "223c0918-5f83-4a78-88da-110d04478f44";
    const proofId = "7f3e2cee-c90c-4a54-b12a-5a9c65a13590";
    const changedAt = new Date("2026-10-26T00:00:00.000Z");
    const adminId = "8a8f4e1a-3d64-4c3b-9f8e-6f6d7c8b9a01";
    mocks.prisma.report.findFirst.mockResolvedValue({
      ...reportData,
      status: "RESOLVED",
      reporter: { name: "Rani", email: "private@example.test" },
      evidences: [
        { id: photoId, kind: "REPORT_PHOTO", mimeType: "image/png", altText: null, createdAt: changedAt },
        { id: proofId, kind: "RESOLUTION_PROOF", mimeType: "image/png", altText: "Bukti", createdAt: changedAt }
      ],
      statusHistories: [
        { fromStatus: null, toStatus: "SUBMITTED", changedBy: user.id, reason: null, createdAt: changedAt },
        { fromStatus: "SUBMITTED", toStatus: "REJECTED", changedBy: adminId, reason: "private rejection", createdAt: changedAt },
        { fromStatus: "REJECTED", toStatus: "SUBMITTED", changedBy: adminId, reason: "private correction", createdAt: changedAt },
        { fromStatus: "SUBMITTED", toStatus: "VERIFIED", changedBy: adminId, reason: null, createdAt: changedAt },
        { fromStatus: "VERIFIED", toStatus: "IN_PROGRESS", changedBy: adminId, reason: null, createdAt: changedAt },
        { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", changedBy: adminId, reason: null, createdAt: changedAt }
      ],
      followUps: [{
        note: "Perbaikan telah selesai dilakukan",
        isResolutionNote: true,
        resolutionExplanation: "Petugas mengganti lampu dan menguji nyala kembali.",
        createdAt: changedAt,
        evidences: [{ id: proofId, kind: "RESOLUTION_PROOF", mimeType: "image/png", altText: "Bukti" }]
      }]
    });

    const response = await request(app)
      .get("/api/reports/LPR-2026-000001")
      .set("Origin", frontend);

    expect(response.status).toBe(200);
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        publicCode: "LPR-2026-000001",
        isHidden: false,
        status: { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED", "DUPLICATE"] }
      }
    }));
    expect(response.body.data.timeline).toHaveLength(4);
    expect(response.body.data.timeline.every((entry: { actorLabel: string }) =>
      entry.actorLabel === "Administrator platform")).toBe(true);
    expect(response.body.data.followUps).toEqual([{
      note: "Perbaikan telah selesai dilakukan",
      isResolutionNote: true,
      resolutionExplanation: "Petugas mengganti lampu dan menguji nyala kembali.",
      createdAt: changedAt.toISOString()
    }]);
    expect(response.body.data.photos).toEqual([{
      url: expect.stringMatching(/^\/api\/media\/[0-9a-f-]+\?expires=\d+&signature=[a-f0-9]{64}$/),
      mimeType: "image/png"
    }]);
    expect(response.body.data.evidences).toHaveLength(1);
    expect(response.body.data.evidences[0].url).toMatch(/^\/api\/media\/[0-9a-f-]+\?expires=\d+&signature=[a-f0-9]{64}$/);

    const payload = JSON.stringify(response.body);
    expect(payload).not.toContain(user.id);
    expect(payload).not.toContain(adminId);
    expect(payload).not.toContain("private@example.test");
    expect(payload).not.toContain("private rejection");
    expect(payload).not.toContain("private correction");
  });

  it("FR-019 exposes only a primary report link on public duplicate details", async () => {
    mocks.prisma.report.findFirst.mockResolvedValue({
      ...reportData,
      status: "DUPLICATE",
      duplicateOf: { publicCode: "LPR-2026-000002" },
      reporter: { name: "Private Reporter", email: "private@example.test" }
    });

    const response = await request(app)
      .get("/api/reports/LPR-2026-000001")
      .set("Origin", frontend);

    expect(response.status).toBe(200);
    expect(response.body.data.duplicateOf).toEqual({
      code: "LPR-2026-000002",
      url: "/laporan/LPR-2026-000002"
    });
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        duplicateOf: { select: { publicCode: true } }
      })
    }));
    expect(JSON.stringify(response.body)).not.toContain("Private Reporter");
    expect(JSON.stringify(response.body)).not.toContain("private@example.test");
  });

  it("TC-26 returns the same 404 for unknown, malformed, and non-public report codes", async () => {
    mocks.prisma.report.findFirst.mockResolvedValue(null);
    const requests = await Promise.all([
      request(app).get("/api/reports/LPR-2026-000099").set("Origin", frontend),
      request(app).get("/api/reports/LPR-2026-000001").set("Origin", frontend),
      request(app).get("/api/reports/not-a-code").set("Origin", frontend)
    ]);

    for (const response of requests) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: "NOT_FOUND", message: "Laporan tidak ditemukan" }
      });
    }
    expect(mocks.prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        publicCode: "LPR-2026-000001",
        isHidden: false,
        status: { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED", "DUPLICATE"] }
      }
    }));
  });

  it("TC-28 serves only active categories in a stable order", async () => {
    const categories = [
      { id: 1, name: "Jalan rusak", slug: "jalan-rusak" },
      { id: 2, name: "Lampu jalan", slug: "lampu-jalan" }
    ];
    mocks.prisma.reportCategory.findMany.mockResolvedValue(categories);

    const response = await request(app).get("/api/categories").set("Origin", frontend);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: categories });
    expect(mocks.prisma.reportCategory.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { id: "asc" }
    });
  });
});
