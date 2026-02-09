# Data.gov Metrics Dashboard

A comprehensive, polished, and visually rich dashboard for exploring key Data.gov catalog metrics.

## What it shows

- **Catalog scale:** total datasets, organizations, groups
- **Freshness indicators:** recently created and recently modified metadata
- **Activity momentum:** created vs modified records across multiple windows
- **Top publishers:** agencies with the largest dataset footprints
- **Resource formats:** distribution of attachment/data formats
- **License profile:** most common license IDs
- **Top tags:** frequently used metadata tags
- **Recent updates:** latest modified datasets with publisher and format details

## Data source

This dashboard uses the public CKAN API at:

`https://catalog.data.gov/api/3/action`

### Why it uses a snapshot

Data.gov API endpoints do not currently allow browser CORS requests from GitHub Pages origins, so the dashboard uses a **build-time generated JSON snapshot**:

- `public/dashboard-data.json`

The snapshot is refreshed during build/deploy and then served from the same origin as the dashboard UI.

## Quick start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Refreshing dashboard data snapshot

Run:

```bash
npm run generate:data
```

Optional: set an API key for server-side snapshot generation:

- Copy `.env.example` to `.env`
- Set `DATA_GOV_API_KEY=...`

## Build

```bash
npm run build
npm run preview
```

## Hosting (GitHub Pages)

This repo includes a GitHub Actions workflow at:

`.github/workflows/deploy-pages.yml`

It generates a fresh snapshot, builds the app, and deploys `dist/` to GitHub Pages on pushes to:

- `main`
- `cursor/data-gov-metrics-dashboard-1d8c`

Once deployed, the site URL format is:

`https://josh987123.github.io/datagov/`