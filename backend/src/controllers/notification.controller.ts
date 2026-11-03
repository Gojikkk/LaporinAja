import type { Request, RequestHandler } from "express";
import { z } from "zod";
import * as notificationService from "../services/notification.service";
import { HttpError } from "../utils/http-error";
import { sendData } from "../utils/responses";

const notificationIdSchema = z.uuid();

export const listNotifications: RequestHandler = async (request, response) => {
  sendData(response, await notificationService.listNotifications(request.user!.id));
};

export const markNotificationRead: RequestHandler = async (request: Request, response) => {
  const result = notificationIdSchema.safeParse(request.params.id);
  if (!result.success) {
    throw new HttpError(404, "NOT_FOUND", "Notifikasi tidak ditemukan");
  }
  sendData(
    response,
    await notificationService.markNotificationRead(request.user!.id, result.data)
  );
};
