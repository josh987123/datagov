# Data.gov Metrics Dashboard

A comprehensive, polished, and visually rich dashboard centered on **actual federal economic, demographic, spending, debt, labor, and savings/investment indicators**, with catalog metadata retained as optional context.

## Pages and categories

The dashboard is organized into category pages:

1. **Overview**  
   Cross-domain summary of inflation, unemployment, spending flow, debt trajectory, and alerts.
2. **Economy**  
   Income, rent/home value, investment/savings context, wage and payroll trends.
3. **Labor & Prices**  
   Unemployment, labor-force participation, employment-population ratio, CPI/wage trajectories.
4. **Spending & Debt**  
   Monthly outlays/receipts/deficit series, debt metrics, trailing-12-month fiscal aggregates.
5. **Demographics**  
   Population, age, housing composition, homeownership/vacancy, inequality and education attainment.
6. **Catalog Context** (secondary)  
   Metadata diagnostics plus searchable/sortable/exportable recent dataset table.

## Data source

This dashboard combines multiple public federal APIs, including:

- `https://catalog.data.gov/api/3/action` (catalog metadata context)
- BLS public API (labor, inflation, earnings)
- U.S. Census ACS API (demographics and household indicators)
- Treasury Fiscal Data API (debt and monthly spending flow)
- BEA API (investment/savings, when `BEA_API_KEY` is provided)

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