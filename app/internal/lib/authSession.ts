import type { LoginResult } from "./internalApi";

const TOKEN_KEY = "axpo.internal.auth.token";
const USER_KEY = "axpo.internal.auth.user";

export interface SessionState {
  token: string;
  user: LoginResult["user"];
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function saveSession(session: SessionState): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function loadSession(): SessionState | null {
  if (!hasWindow()) {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  const userRaw = window.localStorage.getItem(USER_KEY);

  if (!token || !userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as LoginResult["user"];
    return { token, user };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function validateStoredSession(): Promise<SessionState | null> {
  const session = loadSession();
  if (!session) {
    return null;
  }

  try {
    const response = await fetch("/api/v1/internal/auth/session", {
      headers: {
        authorization: `Bearer ${session.token}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const refreshedToken = response.headers.get("x-access-token");
      if (refreshedToken) {
        window.localStorage.setItem(TOKEN_KEY, refreshedToken);
        return { ...session, token: refreshedToken };
      }

      return session;
    }
  } catch {
    // Network failures are treated as invalid for the entry gate so the app
    // does not route users into protected screens with an unknown session.
  }

  clearSession();
  return null;
}
