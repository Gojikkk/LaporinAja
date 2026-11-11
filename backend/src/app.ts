import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./config/env";
import { corsAndOrigin } from "./middlewares/security";
import { errorHandler } from "./middlewares/errors";
import routes from "./routes";
import { HttpError } from "./utils/http-error";
import { swaggerOptions } from "./config/swagger";

const app = express();

// Trust the first proxy hop (required for Vercel, Netlify, and any reverse proxy)
// so that express-rate-limit reads the correct client IP from X-Forwarded-For
app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(corsAndOrigin);
app.use(express.json({ limit: env.maxUploadRequestBytes }));

// Swagger UI — tersedia di /api-docs
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "LaporinAja API Docs",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
  },
}));

app.use(routes);
app.use((request, _response, next) => {
  next(new HttpError(404, "NOT_FOUND", "Endpoint tidak ditemukan"));
});
app.use(errorHandler);

export default app;
