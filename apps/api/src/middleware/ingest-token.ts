import type { NextFunction, Request, Response } from "express";
import { env } from "../config.js";

export function requireIngestToken(req: Request, res: Response, next: NextFunction): void {
  const providedToken = req.header("x-ingest-token");
  if (!providedToken || providedToken !== env.INGEST_TOKEN) {
    res.status(401).json({
      error: "Unauthorized. Missing or invalid x-ingest-token header."
    });
    return;
  }
  next();
}
