import { env } from "../config.js";

export interface CkanTag {
  name?: string;
  display_name?: string;
}

export interface CkanOrganization {
  id?: string;
  name?: string;
  title?: string;
  display_name?: string;
}

export interface CkanResource {
  url?: string;
  format?: string;
  mimetype?: string;
  datastore_active?: boolean;
  resource_type?: string;
}

export interface CkanPackage {
  id: string;
  title: string;
  notes?: string;
  license_title?: string;
  license_id?: string;
  metadata_created?: string;
  metadata_modified?: string;
  url?: string;
  organization?: CkanOrganization;
  tags?: CkanTag[];
  resources?: CkanResource[];
}

interface CkanSearchResult {
  count: number;
  results: CkanPackage[];
}

interface CkanApiResponse {
  success: boolean;
  result: CkanSearchResult;
  error?: unknown;
}

function buildHeaders(): HeadersInit {
  if (!env.CKAN_API_KEY) {
    return {};
  }

  return {
    "X-CKAN-API-Key": env.CKAN_API_KEY
  };
}

export async function fetchPackagePage(start: number, rows: number): Promise<CkanSearchResult> {
  const params = new URLSearchParams({
    start: String(start),
    rows: String(rows),
    sort: "metadata_modified desc"
  });

  const response = await fetch(`${env.CKAN_BASE_URL}/package_search?${params.toString()}`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`CKAN request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as CkanApiResponse;
  if (!payload.success || !payload.result) {
    throw new Error(`CKAN API returned an unsuccessful response: ${JSON.stringify(payload.error ?? {})}`);
  }

  return payload.result;
}

export function normalizeTagName(tag: CkanTag): string | null {
  const raw = (tag.display_name ?? tag.name ?? "").trim();
  if (!raw) {
    return null;
  }
  return raw.toLowerCase();
}

export function normalizeAgencyName(org: CkanOrganization | undefined): string | null {
  if (!org) {
    return null;
  }

  const raw = (org.title ?? org.display_name ?? org.name ?? "").trim();
  return raw || null;
}

export function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function extractSourceUrl(pkg: CkanPackage): string | null {
  if (pkg.url && pkg.url.trim()) {
    return pkg.url.trim();
  }
  const firstResource = pkg.resources?.find((resource) => resource.url && resource.url.trim());
  return firstResource?.url?.trim() ?? null;
}

const OPEN_FORMAT_KEYWORDS = new Set([
  "csv",
  "json",
  "xml",
  "geojson",
  "parquet",
  "tsv",
  "rdf",
  "txt"
]);

const API_HINT_KEYWORDS = ["api", "query", "endpoint", "datastore"];

function toSignalText(resource: CkanResource): string {
  return `${resource.format ?? ""} ${resource.mimetype ?? ""} ${resource.resource_type ?? ""} ${resource.url ?? ""}`
    .trim()
    .toLowerCase();
}

export function evaluateResourceSignals(resources: CkanResource[] | undefined): {
  resourceCount: number;
  hasOpenFormat: boolean;
  hasApiResource: boolean;
} {
  const list = resources ?? [];
  let hasOpenFormat = false;
  let hasApiResource = false;

  for (const resource of list) {
    const signal = toSignalText(resource);
    if (!hasOpenFormat) {
      for (const keyword of OPEN_FORMAT_KEYWORDS) {
        if (signal.includes(keyword)) {
          hasOpenFormat = true;
          break;
        }
      }
    }

    if (!hasApiResource) {
      if (resource.datastore_active) {
        hasApiResource = true;
      } else {
        hasApiResource = API_HINT_KEYWORDS.some((keyword) => signal.includes(keyword));
      }
    }

    if (hasOpenFormat && hasApiResource) {
      break;
    }
  }

  return {
    resourceCount: list.length,
    hasOpenFormat,
    hasApiResource
  };
}
