import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { I18nProvider } from "../src/lib/i18n-context";
import { initializeCronJobs } from "../src/lib/cron";
import { VersionChecker } from "./components/VersionChecker";

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

export const metadata: Metadata = {
  title: "AXPO Simulator",
  description: "AXPO Simulador",
  applicationName: "AXPO Simulator",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AXPO Simulator",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/axpo-mark.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff3254",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const appEnv = process.env.APP_ENV ?? "local";
  const isProduction = appEnv === "prod";

  // Map environment to display labels
  const envLabelMap: Record<string, string> = {
    local: "LOCAL",
    dev: "DEV",
    preview: "PREVIEW",
    prod: "PRODUCTION",
  };

  const envLabel = envLabelMap[appEnv] || "LOCAL";

  const themeInitScript = `
    (function () {
      try {
        var stored = localStorage.getItem('theme-mode');
        var mode = stored === 'dark' || stored === 'light' ? stored : 'light';
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.colorScheme = mode;
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      }
      // Prevent scroll from changing number input values
      document.addEventListener('wheel', function (e) {
        if (document.activeElement && document.activeElement.type === 'number') {
          document.activeElement.blur();
        }
      }, { passive: false });
    })();
  `;

  return (
    <html
      lang="en"
      translate="no"
      data-theme="light"
      data-brand="custom"
      data-accent="custom"
      data-neutral="gray"
      className={montserrat.variable}
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${montserrat.className} notranslate`}>
        <AppRouterCacheProvider>
          <I18nProvider>
            <VersionChecker />
            <div
              className={`environment-indicator env-${appEnv}`}
              role="status"
              aria-live="polite"
            >
              Environment: {envLabel}
            </div>
            <div className="environment-content">{children}</div>
          </I18nProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
