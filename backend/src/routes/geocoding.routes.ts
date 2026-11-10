import { Router } from "express";
import * as geocodingController from "../controllers/geocoding.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const geocodingRoutes = Router();

geocodingRoutes.get(
  "/location/search",
  requireAuth,
  requireRole("PELAPOR"),
  geocodingController.search
);

export default geocodingRoutes;
