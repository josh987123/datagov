# Data.gov Metrics Dashboard (Monorepo)

Production-ready full-stack dashboard for Data.gov CKAN metrics.

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
- Tracks daily snapshots:
  - total datasets
  - datasets added in last 7/30 days
  - per-agency daily counts for trend charts

### API endpoints

- `GET /health`
- `GET /metrics/summary`
- `GET /metrics/trends?days=30`
- `GET /datasets?search=&agency=&tag=&page=`
- `POST /ingest/run` (protected by `x-ingest-token`)

Includes:
- request logging via `morgan`
- global rate limiting via `express-rate-limit`

### Frontend pages

- **Overview**
  - total datasets
  - datasets added in 7/30 days
  - top agencies
  - common tags
  - last ingest run status/time
- **Datasets**
  - searchable + paginated table
  - filters by agency and tag
- **Trends**
  - dataset growth over time chart
  - top agencies over time chart
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