import type { Browser } from "puppeteer-core";

/**
 * Launches a browser instance appropriate for the current environment.
 *
 * - On Vercel / production serverless environments: uses @sparticuz/chromium,
 *   which ships a Lambda-compatible Chromium binary.
 * - Locally (development): falls back to the full `puppeteer` package that
 *   bundles its own Chrome download.
 */
export async function launchBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    return puppeteerCore.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
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
