import type { RequestHandler } from "express";
import { z } from "zod";
import { reverseLookupLocation, searchLocations } from "../services/geocoding.service";
import { parseQuery } from "../utils/validation";
import { sendData } from "../utils/responses";

const searchSchema = z.object({
  q: z.string().trim().min(3).max(600)
});

const reverseSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180)
});

export const search: RequestHandler = async (request, response) => {
  const { q } = parseQuery(searchSchema, request.query);
  sendData(response, await searchLocations(q));
};

export const reverse: RequestHandler = async (request, response) => {
  const { lat, lon } = parseQuery(reverseSchema, request.query);
  sendData(response, await reverseLookupLocation(lat, lon));
};
