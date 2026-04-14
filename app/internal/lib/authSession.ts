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
