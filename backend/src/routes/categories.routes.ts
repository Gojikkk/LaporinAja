import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { requireAuth, requireCsrf, requireRole } from "../middlewares/auth";

const categoriesRoutes = Router();

categoriesRoutes.get(
  "/admin/categories",
  requireAuth,
  requireRole("ADMIN"),
  categoryController.listAdminCategories
);
categoriesRoutes.post(
  "/admin/categories",
  requireAuth,
  requireRole("ADMIN"),
  requireCsrf,
  categoryController.createCategory
);
categoriesRoutes.patch(
  "/admin/categories/:id",
  requireAuth,
  requireRole("ADMIN"),
  requireCsrf,
  categoryController.updateCategory
);

export default categoriesRoutes;
