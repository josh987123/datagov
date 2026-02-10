import type { LinkHealthStatus } from "@prisma/client";

export interface LinkHealthResult {
  status: LinkHealthStatus;
  httpStatus: number | null;
  checkedAt: Date;
}

export async function checkLinkHealth(url: string, timeoutMs: number): Promise<LinkHealthResult> {
  const checkedAt = new Date();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });

    if (headResponse.ok) {
      return { status: "HEALTHY", httpStatus: headResponse.status, checkedAt };
    }

    // Fallback to GET for servers that do not support HEAD.
    const getResponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });

    return {
      status: getResponse.ok ? "HEALTHY" : "BROKEN",
      httpStatus: getResponse.status,
      checkedAt
    };
  } catch {
    return {
      status: "BROKEN",
      httpStatus: null,
      checkedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}
