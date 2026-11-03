import { Router } from "express";
import authRoutes from "./auth.routes";
import categoriesRoutes from "./categories.routes";
import healthRoutes from "./health.routes";
import mediaRoutes from "./media.routes";
import notificationsRoutes from "./notifications.routes";
import reportsRoutes from "./reports.routes";
import statsRoutes from "./stats.routes";

const routes = Router();

routes.use(healthRoutes);
routes.use("/api/auth", authRoutes);
routes.use("/api", categoriesRoutes);
routes.use("/api", reportsRoutes);
routes.use("/api", statsRoutes);
routes.use("/api", mediaRoutes);
routes.use("/api", notificationsRoutes);

export default routes;
