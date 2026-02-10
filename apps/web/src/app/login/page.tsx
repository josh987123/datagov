"use client";

import { FormEvent, useEffect, useState } from "react";

interface SessionState {
  authenticated: boolean;
  email?: string;
}

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState>({ authenticated: false });

  async function refreshSession(): Promise<void> {
    const response = await fetch("/api/auth/session");
    const data = (await response.json()) as SessionState;
    setSession(data);
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = (await response.json()) as { ok: boolean; message: string };

    setMessage(data.message);
    if (response.ok && data.ok) {
      setPassword("");
      await refreshSession();
    }
  }

  async function onLogout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    setMessage("Logged out.");
    await refreshSession();
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Auth scaffold</h2>
        <p className="mt-1 text-sm text-slate-600">
          Simple email/password scaffold for local protection. Replace with NextAuth or Clerk when ready.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Session</h3>
        <p className="mt-2 text-sm text-slate-600">
          {session.authenticated ? `Authenticated as ${session.email}` : "Not authenticated"}
        </p>
        {session.authenticated ? (
          <button type="button" onClick={onLogout} className="mt-4 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
            Logout
          </button>
        ) : null}
      </section>

      {!session.authenticated ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Login
            </button>
          </form>
        </section>
      ) : null}

      {message ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</section>
      ) : null}
    </main>
  );
}
