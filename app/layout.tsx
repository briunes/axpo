import { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { I18nProvider } from "../src/lib/i18n-context";
import { initializeCronJobs } from "../src/lib/cron";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "./env-indicator.css";

// Initialize cron jobs when the app starts (server-side only)
if (typeof window === "undefined") {
  // Fire-and-forget async initialization
  initializeCronJobs().catch((error) => {
    console.error("[App] Failed to initialize cron jobs:", error);
  });
}

export const metadata = {
  title: "AXPO Simulator",
  description: "AXPO Simulador",
  icons: {
    icon: "/axpo-mark.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const vercelEnv = process.env.VERCEL_ENV ?? "development";
  const isProduction = vercelEnv === "production";
  const envLabel = isProduction ? "PRD / PRODUCTION" : "DEV / PREVIEW";

  return (
    <html lang="en" data-theme="light" data-brand="custom" data-accent="custom" data-neutral="gray" className={montserrat.variable}>
      <body className={montserrat.className}>
        <I18nProvider>
          <div
            className={`environment-indicator ${isProduction ? "env-production" : "env-preview"}`}
            role="status"
            aria-live="polite"
          >
            Environment: {envLabel}
          </div>
          <div className="environment-content">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
