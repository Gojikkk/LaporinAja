import type { RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../utils/http-error";
import { fetchMediaBuffer } from "../services/media.service";

const querySchema = z.object({
  expires: z.coerce.number().int(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const serveMedia: RequestHandler = async (request, response, next) => {
  const id = request.params.id;
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    return next(new HttpError(404, "NOT_FOUND", "File tidak ditemukan"));
  }

  const query = querySchema.safeParse(request.query);
  if (!query.success) {
    return next(new HttpError(404, "NOT_FOUND", "File tidak ditemukan"));
  }

  const { buffer, mimeType } = await fetchMediaBuffer(
    id,
    query.data.expires,
    query.data.signature,
    request.user
  );

  response.type(mimeType);
  response.setHeader("Cache-Control", "private, max-age=60");
  response.send(buffer);
};
