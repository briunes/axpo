import type { Browser } from "puppeteer-core";

// Remote Chromium binary used as fallback when the bundled binary is missing
// (e.g. Vercel pnpm deployments where file-tracing misses the /bin directory).
// NOTE: as of v147.0.0 the pack files are architecture-specific; Vercel runs x64.
const CHROMIUM_REMOTE_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

/**
 * Launches a browser instance appropriate for the current environment.
 *
 * - On Vercel / production serverless environments: uses @sparticuz/chromium,
 *   which ships a Lambda-compatible Chromium binary.
 *   Falls back to downloading the binary from GitHub releases if the bundled
 *   binary is not present (e.g. pnpm deployment where /bin was not traced).
 * - Locally (development): falls back to the full `puppeteer` package that
 *   bundles its own Chrome download.
 */
export async function launchBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    // Try the bundled binary first; if the /bin directory was not included in
    // the deployment bundle, fall back to the remote URL.
    let executablePath: string;
    try {
      executablePath = await chromium.executablePath();
    } catch {
      console.warn(
        "[browserLauncher] Bundled Chromium binary not found — downloading from remote URL.",
      );
      executablePath = await chromium.executablePath(CHROMIUM_REMOTE_URL);
    }

    return puppeteerCore.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath,
      headless: true,
    }) as unknown as Browser;
  }

  // Local development — full puppeteer with its bundled Chrome
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as Browser;
}
