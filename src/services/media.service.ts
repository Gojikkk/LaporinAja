import { type ReportStatus } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../utils/http-error";
import { validMediaSignature } from "../utils/media-signature";
import { imageUrl } from "../utils/uploads";

const publicStatuses: ReportStatus[] = ["VERIFIED", "IN_PROGRESS", "RESOLVED", "DUPLICATE"];

export type MediaRequester = {
  id: string;
  role: "PELAPOR" | "ADMIN";
} | undefined;

export async function fetchMediaBuffer(
  id: string,
  expires: number,
  signature: string,
  requester: MediaRequester
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!validMediaSignature(id, expires, signature)) {
    throw new HttpError(404, "NOT_FOUND", "File tidak ditemukan");
  }

  const evidence = await prisma.reportEvidence.findUnique({
    where: { id },
    include: {
      report: { select: { reporterId: true, status: true, isHidden: true } },
    },
  });
  if (!evidence) throw new HttpError(404, "NOT_FOUND", "File tidak ditemukan");

  const isPublic =
    !evidence.report.isHidden &&
    publicStatuses.includes(evidence.report.status);
  const isOwner = requester?.id === evidence.report.reporterId;
  const isAdmin = requester?.role === "ADMIN";

  if (!isPublic && !isOwner && !isAdmin) {
    throw new HttpError(404, "NOT_FOUND", "File tidak ditemukan");
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl(evidence.storageKey), {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(502, "MEDIA_UNAVAILABLE", "Gambar tidak dapat dimuat");
  }

  if (!upstream.ok || !upstream.body) {
    throw new HttpError(404, "NOT_FOUND", "File tidak ditemukan");
  }

  return {
    buffer: Buffer.from(await upstream.arrayBuffer()),
    mimeType: evidence.mimeType,
  };
}
