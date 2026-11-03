import { prisma } from "../db";
import { HttpError } from "../utils/http-error";

export async function listNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    include: { report: { select: { publicCode: true } } },
    orderBy: { createdAt: "desc" }
  });
  return notifications.map(({ id, type, message, isRead, createdAt, report }) => ({
    id,
    type,
    message,
    isRead,
    createdAt,
    reportCode: report.publicCode,
    reportUrl: `/laporan/${report.publicCode}`
  }));
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: { id, userId },
      data: { isRead: true }
    });
    const notification = await tx.notification.findFirst({
      where: { id, userId },
      include: { report: { select: { publicCode: true } } }
    });
    if (!notification) {
      throw new HttpError(404, "NOT_FOUND", "Notifikasi tidak ditemukan");
    }

    return {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      reportCode: notification.report.publicCode,
      reportUrl: `/laporan/${notification.report.publicCode}`
    };
  });
}
