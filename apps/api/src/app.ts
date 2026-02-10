import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import type { HealthResponse } from "@datagov/shared";
import { prisma } from "./db.js";
import { env } from "./config.js";
import {
  getAgencyDetail,
  getAgencies,
  getDatasets,
  getIngestRuns,
  getMetricsInsights,
  getMetricsSummary,
  getMetricsTrends
} from "./services/metrics.js";
import { runIngestion } from "./services/ingestion.js";
import { requireIngestToken } from "./middleware/ingest-token.js";

function buildCorsOriginConfig(): cors.CorsOptions["origin"] {
  if (env.CORS_ORIGIN === "*") {
    return true;
  }
  return env.CORS_ORIGIN.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30)
});

const datasetsQuerySchema = z.object({
  search: z.string().optional(),
  agency: z.string().optional(),
  tag: z.string().optional(),
  minQuality: z.coerce.number().min(0).max(100).optional(),
  staleOnly: z
    .union([z.string(), z.boolean()])
    .transform((value) => String(value).toLowerCase() === "true")
    .optional(),
  sort: z.enum(["recent", "quality", "openness", "freshness"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
});

const insightsQuerySchema = z.object({
  days: z.coerce.number().int().min(30).max(365).optional().default(90)
});

const ingestRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25)
});

const agenciesQuerySchema = z.object({
  search: z.string().optional(),
  minQuality: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
});

const agencyDetailQuerySchema = z.object({
  days: z.coerce.number().int().min(30).max(365).optional().default(180)
});

export const app: express.Express = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: buildCorsOriginConfig()
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));
app.use(
  rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", async (_req, res) => {
  let database: HealthResponse["database"] = "ok";
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch {
    database = "error";
  }

  const body: HealthResponse = {
    status: database === "ok" ? "ok" : "error",
    service: "us-data-dashboard-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database
  };

  res.status(database === "ok" ? 200 : 503).json(body);
});

app.get("/metrics/summary", async (_req, res, next) => {
  try {
    const summary = await getMetricsSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get("/metrics/trends", async (req, res, next) => {
  try {
    const parsed = trendsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const trends = await getMetricsTrends(parsed.data.days);
    res.json(trends);
  } catch (error) {
    next(error);
  }
});

app.get("/metrics/insights", async (req, res, next) => {
  try {
    const parsed = insightsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const insights = await getMetricsInsights(parsed.data.days);
    res.json(insights);
  } catch (error) {
    next(error);
  }
});

app.get("/datasets", async (req, res, next) => {
  try {
    const parsed = datasetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const datasets = await getDatasets(parsed.data);
    res.json(datasets);
  } catch (error) {
    next(error);
  }
});

app.get("/agencies", async (req, res, next) => {
  try {
    const parsed = agenciesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const agencies = await getAgencies(parsed.data);
    res.json(agencies);
  } catch (error) {
    next(error);
  }
});

app.get("/agencies/:agencyId", async (req, res, next) => {
  try {
    const agencyId = Number(req.params.agencyId);
    if (!Number.isInteger(agencyId) || agencyId <= 0) {
      res.status(400).json({ error: "Invalid agency id." });
      return;
    }

    const parsedQuery = agencyDetailQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({ error: parsedQuery.error.flatten() });
      return;
    }

    const detail = await getAgencyDetail(agencyId, parsedQuery.data.days);
    if (!detail) {
      res.status(404).json({ error: "Agency not found." });
      return;
    }

    res.json(detail);
  } catch (error) {
    next(error);
  }
});

app.get("/ingest/runs", async (req, res, next) => {
  try {
    const parsed = ingestRunsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const runs = await getIngestRuns(parsed.data.limit);
    res.json(runs);
  } catch (error) {
    next(error);
  }
});

app.post("/ingest/run", requireIngestToken, async (_req, res, next) => {
  try {
    const run = await runIngestion();
    res.status(202).json({ run });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  res.status(500).json({ error: message });
});
