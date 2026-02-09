# Data.gov Metrics Dashboard

A comprehensive, polished, and visually rich dashboard for exploring key Data.gov catalog metrics in real time.

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

An API key is optional for these reads, but the UI supports adding one if needed.

## Quick start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Optional API key

You can provide a key in two ways:

1. Environment variable:
   - Copy `.env.example` to `.env`
   - Set `VITE_DATA_GOV_API_KEY=...`
2. Dashboard UI:
   - Paste in the **Optional API key** field and click **Apply**
   - The key is stored in local browser storage for convenience

## Build

```bash
npm run build
npm run preview
```

## Hosting (GitHub Pages)

This repo includes a GitHub Actions workflow at:

`.github/workflows/deploy-pages.yml`

It builds the app and deploys `dist/` to GitHub Pages on pushes to:

- `main`
- `cursor/data-gov-metrics-dashboard-1d8c`

Once deployed, the site URL format is:

`https://josh987123.github.io/datagov/`