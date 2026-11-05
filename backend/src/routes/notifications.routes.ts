import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { requireAuth, requireCsrf, requireRole } from "../middlewares/auth";

const notificationsRoutes = Router();

notificationsRoutes.get(
  "/me/notifications",
  requireAuth,
  requireRole("PELAPOR"),
  notificationController.listNotifications
);
notificationsRoutes.patch(
  "/me/notifications/:id/read",
  requireAuth,
  requireRole("PELAPOR"),
  requireCsrf,
  notificationController.markNotificationRead
);

export default notificationsRoutes;
