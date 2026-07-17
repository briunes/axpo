export const isBlockedPdfResource = (rawUrl: string): boolean => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return true;
  }

  if (["data:", "blob:", "about:"].includes(url.protocol)) return false;
  if (!["http:", "https:"].includes(url.protocol)) return true;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  return false;
};

export const installPdfResourceGuard = async (page: {
  setRequestInterception(enabled: boolean): Promise<void>;
  on(
    event: "request",
    callback: (request: {
      url(): string;
      abort(errorCode?: string): Promise<void> | void;
      continue(): Promise<void> | void;
    }) => void,
  ): void;
}) => {
  await page.setRequestInterception(true);
  page.on("request", (resourceRequest) => {
    if (isBlockedPdfResource(resourceRequest.url())) {
      void resourceRequest.abort("blockedbyclient");
    } else {
      void resourceRequest.continue();
    }
  });
};
