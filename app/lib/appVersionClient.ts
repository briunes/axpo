"use client";

const VERSION_STORAGE_KEY = "axpo_app_version";
const VERSION_RELOAD_KEY = "axpo_app_version_reload";
const VERSION_HEADER = "x-axpo-app-version";
const VERSION_ERROR_CODE = "APP_VERSION_OUTDATED";
const VERSION_QUERY_PARAM = "__axpo_v";
const PAGE_PATH_HEADER = "x-axpo-page-path";

type VersionErrorEnvelope = {
  appVersion?: string;
  error?: {
    code?: string;
    details?: {
      currentVersion?: string;
    };
  };
};

declare global {
  interface Window {
    __axpoVersionedFetchInstalled?: boolean;
  }
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  const rawUrl =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : input;

  try {
    const url = new URL(rawUrl, window.location.origin);
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/") &&
      url.pathname !== "/api/v1/public/version"
    );
  } catch {
    return false;
  }
}

function requestWithVersion(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  version: string | null,
): [RequestInfo | URL, RequestInit | undefined] {
  if (input instanceof Request) {
    const headers = new Headers(input.headers);
    if (version) headers.set(VERSION_HEADER, version);
    headers.set(
      PAGE_PATH_HEADER,
      window.location.pathname,
    );
    return [new Request(input, { headers }), init];
  }

  const headers = new Headers(init?.headers);
  if (version) headers.set(VERSION_HEADER, version);
  headers.set(
    PAGE_PATH_HEADER,
    window.location.pathname,
  );
  return [input, { ...init, headers }];
}

async function clearBrowserCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const names = await window.caches.keys();
  await Promise.all(names.map((name) => window.caches.delete(name)));
}

function reloadForVersion(currentVersion: string): void {
  const previousAttempt = sessionStorage.getItem(VERSION_RELOAD_KEY);
  const currentUrl = new URL(window.location.href);

  if (
    previousAttempt === currentVersion &&
    currentUrl.searchParams.get(VERSION_QUERY_PARAM) === currentVersion
  ) {
    return;
  }

  sessionStorage.setItem(VERSION_RELOAD_KEY, currentVersion);
  localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
  currentUrl.searchParams.set(VERSION_QUERY_PARAM, currentVersion);

  void clearBrowserCaches().finally(() => {
    window.location.replace(currentUrl.toString());
  });
}

async function handleVersionResponse(response: Response): Promise<void> {
  if (response.status !== 409) return;

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as VersionErrorEnvelope | null;

  if (body?.error?.code !== VERSION_ERROR_CODE) return;

  const currentVersion =
    body.error.details?.currentVersion ?? body.appVersion;
  if (currentVersion) reloadForVersion(currentVersion);
}

export function installVersionedFetch(): void {
  if (
    typeof window === "undefined" ||
    window.__axpoVersionedFetchInstalled
  ) {
    return;
  }

  window.__axpoVersionedFetchInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const version = localStorage.getItem(VERSION_STORAGE_KEY);
    const request: [RequestInfo | URL, RequestInit | undefined] =
      isSameOriginApiRequest(input)
        ? requestWithVersion(input, init, version)
        : [input, init];

    const response = await nativeFetch(request[0], request[1]);
    await handleVersionResponse(response);
    return response;
  };
}

export function storeInitialAppVersion(version: string): void {
  if (!version || localStorage.getItem(VERSION_STORAGE_KEY) !== null) return;
  localStorage.setItem(VERSION_STORAGE_KEY, version);
}
