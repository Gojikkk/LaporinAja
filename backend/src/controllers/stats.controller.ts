import type { RequestHandler } from "express";
import * as statsService from "../services/stats.service";
import { sendData } from "../utils/responses";

export const getPublicStats: RequestHandler = async (_request, response) => {
  sendData(response, await statsService.getPublicStats());
};

export const getPublicCategoryTrends: RequestHandler = async (_request, response) => {
  sendData(response, await statsService.getPublicCategoryTrends());
};

export const getAdminStats: RequestHandler = async (_request, response) => {
  sendData(response, await statsService.getAdminStats());
};
