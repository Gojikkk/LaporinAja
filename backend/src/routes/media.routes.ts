import { Router } from "express";
import * as mediaController from "../controllers/media.controller";
import { optionalAuth } from "../middlewares/auth";

const mediaRoutes = Router();

mediaRoutes.get("/media/:id", optionalAuth, mediaController.serveMedia);

export default mediaRoutes;
