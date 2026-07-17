import type { Browser } from "puppeteer-core";

// Remote Chromium binary used by @sparticuz/chromium-min. Keeping the binary
// outside the serverless package avoids Vercel pnpm symlink packaging issues.
// NOTE: as of v147.0.0 the pack files are architecture-specific; Vercel runs x64.
const CHROMIUM_REMOTE_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

/**
 * Launches a browser instance appropriate for the current environment.
 *
 * - On Vercel / production serverless environments: uses @sparticuz/chromium-min,
 *   downloading a Lambda-compatible Chromium binary from GitHub releases.
 * - Locally (development): falls back to the full `puppeteer` package that
 *   bundles its own Chrome download.
 */
export async function launchBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;
    const executablePath = await chromium.executablePath(CHROMIUM_REMOTE_URL);

    return puppeteerCore.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath,
      headless: true,
    }) as unknown as Browser;
  }

  // Local development — full puppeteer with its bundled Chrome
  const puppeteerModule = (await import("puppeteer")) as any;
  const puppeteer = [
    puppeteerModule,
    puppeteerModule.default,
    puppeteerModule.default?.default,
    puppeteerModule.puppeteer,
    puppeteerModule.default?.puppeteer,
  ].find((candidate) => typeof candidate?.launch === "function");

  if (!puppeteer) {
    throw new Error("Unable to resolve Puppeteer launch function");
  }

  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as Browser;
}
