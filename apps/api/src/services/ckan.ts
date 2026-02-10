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
}

export interface CkanPackage {
  id: string;
  title: string;
  notes?: string;
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
