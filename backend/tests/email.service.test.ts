import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail }))
  };
});

vi.mock("nodemailer", () => ({ createTransport: mocks.createTransport }));
vi.mock("../src/config/env", () => ({
  env: {
    frontendOrigins: ["http://localhost:5173"],
    smtp: {
      host: "smtp.test",
      port: 587,
      secure: false,
      user: "test-user",
      password: "test-password",
      from: "LaporinAja <noreply@example.test>"
    }
  }
}));

import { sendReportStatusEmail } from "../src/services/email.service";

describe("report status email delivery", () => {
  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.sendMail.mockResolvedValue({ messageId: "test-message-id" });
  });

  it("sends a detailed text and HTML status email with escaped report content", async () => {
    await sendReportStatusEmail({
      to: "rani@example.test",
      reportCode: "LPR-2026-000001",
      reportTitle: "<Lampu rusak>",
      previousStatus: "IN_PROGRESS",
      newStatus: "RESOLVED",
      message: "Perbaikan <selesai> & diuji."
    });

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "LaporinAja <noreply@example.test>",
      to: "rani@example.test",
      subject: "Status laporan LPR-2026-000001 diperbarui",
      text: expect.stringContaining("Status sebelumnya: Sedang ditindaklanjuti"),
      html: expect.stringContaining("&lt;Lampu rusak&gt;")
    }));

    const email = mocks.sendMail.mock.calls[0][0];
    expect(email.text).toContain("Status terbaru: Selesai");
    expect(email.text).toContain("http://localhost:5173/laporan/LPR-2026-000001");
    expect(email.html).toContain("Perbaikan &lt;selesai&gt; &amp; diuji.");
    expect(email.html).not.toContain("<Lampu rusak>");
  });
});
