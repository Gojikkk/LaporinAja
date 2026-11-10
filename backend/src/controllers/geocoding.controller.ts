import type { RequestHandler } from "express";
import { z } from "zod";
import { searchLocations } from "../services/geocoding.service";
import { parseQuery } from "../utils/validation";
import { sendData } from "../utils/responses";

const searchSchema = z.object({
  q: z.string().trim().min(3).max(600)
});

export const search: RequestHandler = async (request, response) => {
  const { q } = parseQuery(searchSchema, request.query);
  sendData(response, await searchLocations(q));
};
