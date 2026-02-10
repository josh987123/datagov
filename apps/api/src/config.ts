import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CKAN_BASE_URL: z.string().url().default("https://catalog.data.gov/api/3/action"),
  CKAN_API_KEY: z.string().optional(),
  CKAN_PAGE_SIZE: z.coerce.number().int().min(10).max(1000).default(100),
  CKAN_MAX_PAGES: z.coerce.number().int().min(1).max(10000).default(20),
  INGEST_TOKEN: z.string().min(1, "INGEST_TOKEN is required"),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  CORS_ORIGIN: z.string().default("*")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid API environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
