function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeDaysSinceModified(metadataModified: Date | null): number | null {
  if (!metadataModified) {
    return null;
  }
  const now = Date.now();
  const deltaMs = now - metadataModified.getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return 0;
  }
  return Math.floor(deltaMs / (24 * 60 * 60 * 1000));
}

export function computeFreshnessScore(daysSinceModified: number | null): number {
  if (daysSinceModified === null) {
    return 0;
  }
  const bounded = clamp(daysSinceModified, 0, 730);
  // 0 days => 100, 365 days => 50, 730 days => 0.
  return Number((100 - (bounded / 730) * 100).toFixed(2));
}

export function computeQualityScore(input: {
  hasDescription: boolean;
  tagCount: number;
  resourceCount: number;
  hasLicense: boolean;
  freshnessScore: number;
}): number {
  const descriptionScore = input.hasDescription ? 100 : 0;
  const tagScore = clamp((input.tagCount / 8) * 100, 0, 100);
  const resourceScore = clamp((input.resourceCount / 10) * 100, 0, 100);
  const licenseScore = input.hasLicense ? 100 : 0;

  const weighted =
    descriptionScore * 0.3 +
    tagScore * 0.2 +
    resourceScore * 0.2 +
    input.freshnessScore * 0.2 +
    licenseScore * 0.1;

  return Number(clamp(weighted, 0, 100).toFixed(2));
}

export function computeOpennessScore(input: {
  hasOpenFormat: boolean;
  hasApiResource: boolean;
  hasLicense: boolean;
  resourceCount: number;
}): number {
  const openFormatScore = input.hasOpenFormat ? 100 : 0;
  const apiScore = input.hasApiResource ? 100 : 0;
  const licenseScore = input.hasLicense ? 100 : 0;
  const resourceScore = clamp((input.resourceCount / 10) * 100, 0, 100);

  const weighted = openFormatScore * 0.4 + apiScore * 0.3 + licenseScore * 0.2 + resourceScore * 0.1;
  return Number(clamp(weighted, 0, 100).toFixed(2));
}
