import { Router } from "express";
import * as statsController from "../controllers/stats.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const statsRoutes = Router();

statsRoutes.get("/stats/public", statsController.getPublicStats);
statsRoutes.get("/stats/trends", statsController.getPublicCategoryTrends);
statsRoutes.get(
  "/admin/stats",
  requireAuth,
  requireRole("ADMIN"),
  statsController.getAdminStats
);

export default statsRoutes;
