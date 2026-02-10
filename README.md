# US Data Dashboard (Monorepo)

Production-ready full-stack analytics platform for Data.gov CKAN metadata.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + Recharts
- **Backend API:** Express + TypeScript + Prisma
- **Database:** PostgreSQL
- **Shared package:** workspace types under `@datagov/shared`

## Repository layout

```text
apps/
  web/        # Next.js frontend
  api/        # Express API + Prisma schema/migrations
packages/
  shared/     # shared TS types
```

## Core features

### Data ingestion layer

- Pulls CKAN dataset catalog pages from Data.gov (`package_search`)
- Normalizes and stores:
  - datasets
  - agencies
  - tags
  - timestamps (`metadata_created`, `metadata_modified`)
- Deduplicates by CKAN dataset identifier (`ckanId`)
- Computes intelligence fields per dataset:
  - `qualityScore` (metadata depth + freshness + resources + license)
  - `opennessScore` (open formats + API-like resources + license)
  - `freshnessScore`, `daysSinceModified`
  - open/API flags and optional link health status
- Tracks daily snapshots:
  - total datasets
  - net daily dataset change
  - datasets added in last 7/30 days
  - quality/openness averages
  - stale/open/API coverage shares
  - broken link counts
  - per-agency daily counts for trend charts

Optional link-checking is supported and controlled by env flags:

- `LINK_CHECK_ENABLED`
- `LINK_CHECK_MAX_PER_RUN`
- `LINK_CHECK_TIMEOUT_MS`

### API endpoints

- `GET /health`
- `GET /metrics/summary`
- `GET /metrics/trends?days=30`
- `GET /metrics/insights?days=90`
- `GET /datasets?search=&agency=&tag=&minQuality=&staleOnly=&sort=&page=`
- `GET /agencies?search=&minQuality=&page=`
- `GET /agencies/:agencyId?days=180`
- `GET /ingest/runs?limit=25`
- `POST /ingest/run` (protected by `x-ingest-token`)

Includes:
- request logging via `morgan`
- global rate limiting via `express-rate-limit`

### Frontend pages

- **Overview**
  - KPI cards for volume, quality, openness, staleness, and link health
  - growth/score/exposure trend visualization
  - automated insight previews
  - ingest timeline and top-agency summary
- **Insights**
  - interpretable auto-generated findings with severity and recommendations
  - configurable analysis window
- **Agencies**
  - leaderboard with scale, quality, openness, stale share, and 30d growth
  - filterable and paginated
- **Agency detail**
  - per-agency trend line
  - freshness distribution
  - top tags
  - recent datasets + quality/openness snapshots
- **Datasets**
  - searchable + paginated table
  - filters by agency, tag, quality threshold, stale-only
  - sorting by recent/quality/openness/freshness
- **Trends**
  - dataset growth over time
  - quality/openness trend lines
  - staleness/open/API exposure trends
  - top agencies over time
- **Auth (scaffold)**
  - optional simple email/password scaffold routes and login page

## Environment setup

Use the per-app examples:

- `apps/api/.env.example`
- `apps/web/.env.example`

### Minimal required values

For API (`apps/api/.env`):

- `DATABASE_URL=postgresql://...`
- `INGEST_TOKEN=...`

For web (`apps/web/.env`):

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

Optional auth scaffold (web):

- `AUTH_EMAIL`
- `AUTH_PASSWORD`
- `AUTH_SECRET`
- `AUTH_COOKIE_NAME`

## Local development

1. Install deps:

```bash
pnpm install
```

2. Configure env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Run migrations:

```bash
pnpm db:migrate
```

4. Run initial ingestion:

```bash
pnpm ingest
```

5. Start both apps:

```bash
pnpm dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000`

## Scripts

- `pnpm dev` – run web + API
- `pnpm build` – build all workspace packages
- `pnpm db:migrate` – run Prisma migrations (API)
- `pnpm ingest` – trigger ingestion job (API script)
- `pnpm seed` – run seed script (currently performs ingest)

## Prisma

- Schema: `apps/api/prisma/schema.prisma`
- Migration: `apps/api/prisma/migrations/*`
- Seed: `apps/api/prisma/seed.ts`

## Docker (API)

Backend Dockerfile:

- `apps/api/Dockerfile`

Build from repo root (so workspace deps are available):

```bash
docker build -f apps/api/Dockerfile -t datagov-api .
```

## CI

A lightweight CI workflow is included at:

- `.github/workflows/ci.yml`

It installs dependencies, runs lint, and builds the monorepo.

## Scheduled ingest

A cron workflow is included at:

- `.github/workflows/scheduled-ingest.yml`

It triggers the ingest endpoint every 6 hours (and supports manual dispatch).

Required repository secrets:

- `INGEST_ENDPOINT` (e.g. `https://api.your-domain.com`)
- `INGEST_TOKEN` (must match API `INGEST_TOKEN`)