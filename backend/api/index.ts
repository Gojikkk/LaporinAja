import type { Request, Response } from "express";

let app: any;
let initError: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app = require("../src/app").default;
} catch (error: any) {
  initError = error;
  console.error("FATAL: Backend failed to initialize:", error);
}

export default function handler(req: Request, res: Response) {
  if (initError) {
    const origin = req.headers.origin as string;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return res.status(500).json({
      error: "SERVER_INIT_FAILED",
      message: initError?.message || String(initError),
      stack: initError?.stack
    });
  }

  return app(req, res);
}

module.exports = handler;
