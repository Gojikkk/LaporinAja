import "dotenv/config";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters");
}

const maxUploadRequestBytes = Number(process.env.MAX_UPLOAD_REQUEST_BYTES ?? 20 * 1024 * 1024);
if (!Number.isSafeInteger(maxUploadRequestBytes) || maxUploadRequestBytes < 1024 * 1024) {
  throw new Error("MAX_UPLOAD_REQUEST_BYTES must be an integer of at least 1 MB");
}

const sessionTtlDays = Number(process.env.SESSION_TTL_DAYS ?? 7);
if (!Number.isSafeInteger(sessionTtlDays) || sessionTtlDays < 1) {
  throw new Error("SESSION_TTL_DAYS must be a positive integer");
}

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
if (!cloudinaryCloudName) {
  throw new Error("CLOUDINARY_CLOUD_NAME is required");
}

const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
if (!cloudinaryApiKey) {
  throw new Error("CLOUDINARY_API_KEY is required");
}

const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudinaryApiSecret) {
  throw new Error("CLOUDINARY_API_SECRET is required");
}

const smtpHost = process.env.SMTP_HOST?.trim();
const smtpFrom = process.env.SMTP_FROM?.trim();
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpConfigured = Boolean(smtpHost || smtpFrom || smtpUser || smtpPassword);
const smtpPort = Number(process.env.SMTP_PORT || 587);
if (smtpConfigured && (!smtpHost || !smtpFrom)) {
  throw new Error("SMTP_HOST and SMTP_FROM are required when SMTP is configured");
}
if (smtpConfigured && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
  throw new Error("SMTP_PORT must be a valid port number");
}
if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
  throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together");
}

export const env = {
  frontendOrigins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  sessionSecret,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === "true",
  sessionTtlDays,
  maxUploadRequestBytes,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? "laporinaja",
  smtp: smtpConfigured
    ? {
        host: smtpHost!,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === "true",
        user: smtpUser,
        password: smtpPassword,
        from: smtpFrom!
      }
    : undefined
};
