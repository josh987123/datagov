import type { SessionResponse } from "@datagov/shared";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth";

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const email = verifySessionCookieValue(cookieValue);

  if (!email) {
    const unauthenticated: SessionResponse = { authenticated: false };
    return NextResponse.json(unauthenticated);
  }

  const authenticated: SessionResponse = {
    authenticated: true,
    email
  };
  return NextResponse.json(authenticated);
}
