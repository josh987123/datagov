import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "dashboard_auth";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for auth scaffold.");
  }
  return secret;
}

function signValue(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionCookieValue(email: string): string {
  const signature = signValue(email);
  return `${email}.${signature}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [email, signature] = cookieValue.split(".");
  if (!email || !signature) {
    return null;
  }

  const expected = signValue(email);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return email;
}

export function credentialsMatch(email: string, password: string): boolean {
  const configuredEmail = process.env.AUTH_EMAIL;
  const configuredPassword = process.env.AUTH_PASSWORD;
  if (!configuredEmail || !configuredPassword) {
    return false;
  }

  return email === configuredEmail && password === configuredPassword;
}
