import type { LoginRequest, LoginResponse } from "@datagov/shared";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionCookieValue, credentialsMatch } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  let body: LoginRequest;
  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    const invalid: LoginResponse = { ok: false, message: "Invalid JSON body." };
    return NextResponse.json(invalid, { status: 400 });
  }

  if (!body.email || !body.password) {
    const missing: LoginResponse = { ok: false, message: "Email and password are required." };
    return NextResponse.json(missing, { status: 400 });
  }

  const authConfigured = Boolean(process.env.AUTH_EMAIL && process.env.AUTH_PASSWORD && process.env.AUTH_SECRET);
  if (!authConfigured) {
    const unavailable: LoginResponse = {
      ok: false,
      message: "Auth scaffold is not configured. Set AUTH_EMAIL, AUTH_PASSWORD, and AUTH_SECRET."
    };
    return NextResponse.json(unavailable, { status: 503 });
  }

  if (!credentialsMatch(body.email, body.password)) {
    const unauthorized: LoginResponse = { ok: false, message: "Invalid credentials." };
    return NextResponse.json(unauthorized, { status: 401 });
  }

  const response = NextResponse.json<LoginResponse>({ ok: true, message: "Authenticated." });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionCookieValue(body.email),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
