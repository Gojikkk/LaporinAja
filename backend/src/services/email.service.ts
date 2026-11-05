import { createTransport } from "nodemailer";
import { env } from "../config/env";

const transporter = env.smtp
  ? createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      ...(env.smtp.user && env.smtp.password
        ? { auth: { user: env.smtp.user, pass: env.smtp.password } }
        : {})
    })
  : undefined;

type ReportStatusEmail = {
  to: string;
  reportCode: string;
  reportTitle: string;
  previousStatus: string;
  newStatus: string;
  message: string;
};

const statusLabels: Record<string, string> = {
  SUBMITTED: "Dikirim",
  VERIFIED: "Terverifikasi",
  IN_PROGRESS: "Sedang ditindaklanjuti",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
  DUPLICATE: "Duplikat"
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]!);
}

export async function sendReportStatusEmail({
  to,
  reportCode,
  reportTitle,
  previousStatus,
  newStatus,
  message
}: ReportStatusEmail) {
  if (!env.smtp || !transporter) {
    console.warn("SMTP belum dikonfigurasi; email perubahan status tidak dikirim", { reportCode });
    return;
  }

  const frontendOrigin = env.frontendOrigins[0] ?? "http://localhost:5173";
  const reportUrl = `${frontendOrigin}/laporan/${reportCode}`;
  const previousStatusLabel = statusLabels[previousStatus] ?? previousStatus;
  const newStatusLabel = statusLabels[newStatus] ?? newStatus;
  const escapedTitle = escapeHtml(reportTitle);
  const escapedCode = escapeHtml(reportCode);
  const escapedMessage = escapeHtml(message);
  const escapedUrl = escapeHtml(reportUrl);

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject: `Status laporan ${reportCode} diperbarui`,
    text: [
      "Halo,",
      "",
      "Ada pembaruan pada laporan yang Anda kirim ke LaporinAja.",
      "",
      `Judul laporan: ${reportTitle}`,
      `Kode laporan: ${reportCode}`,
      `Status sebelumnya: ${previousStatusLabel}`,
      `Status terbaru: ${newStatusLabel}`,
      "",
      message,
      "",
      "Untuk melihat detail dan riwayat laporan, buka tautan berikut:",
      reportUrl,
      "",
      "Jika tautan tidak bisa dibuka, masuk ke LaporinAja dan cari laporan menggunakan kode di atas.",
      "",
      "Email ini dikirim otomatis oleh LaporinAja."
    ].join("\n"),
    html: [
      "<div style=\"font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:auto\">",
      "<h2 style=\"color:#176b57\">Pembaruan status laporan</h2>",
      "<p>Halo,</p>",
      "<p>Ada pembaruan pada laporan yang Anda kirim ke LaporinAja.</p>",
      "<table style=\"border-collapse:collapse;width:100%;margin:20px 0\">",
      `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Judul laporan</strong></td><td style="padding:8px;border:1px solid #ddd">${escapedTitle}</td></tr>`,
      `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Kode laporan</strong></td><td style="padding:8px;border:1px solid #ddd">${escapedCode}</td></tr>`,
      `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Status sebelumnya</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(previousStatusLabel)}</td></tr>`,
      `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Status terbaru</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(newStatusLabel)}</td></tr>`,
      "</table>",
      `<p>${escapedMessage}</p>`,
      `<p style="margin:24px 0"><a href="${escapedUrl}" style="background:#176b57;color:#fff;padding:12px 18px;text-decoration:none;border-radius:4px">Lihat detail laporan</a></p>`,
      "<p>Jika tautan tidak bisa dibuka, masuk ke LaporinAja dan cari laporan menggunakan kode di atas.</p>",
      "<hr style=\"border:0;border-top:1px solid #eee;margin:24px 0\">",
      "<small>Email ini dikirim otomatis oleh LaporinAja. Mohon tidak membalas email ini.</small>",
      "</div>"
    ].join("")
  });
}
