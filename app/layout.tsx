import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { I18nProvider } from "../src/lib/i18n-context";
import { BoneyardRegistry } from "./components/BoneyardRegistry";
import { VersionChecker } from "./components/VersionChecker";
import { WhatsNewModal } from "./components/WhatsNewModal";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

import "./env-indicator.css";

export const metadata: Metadata = {
  title: "AXPO Simulator",
  description: "AXPO Simulador",
  applicationName: "AXPO Simulator",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/axpo-mark.svg",
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
            <BoneyardRegistry />
            <VersionChecker />
            <WhatsNewModal />
            {!isProduction && (
              <div
                className={`environment-indicator env-${appEnv}`}
                role="status"
                aria-live="polite"
              >
                Environment: {envLabel}
              </div>
            )}
            <div
              className={`environment-content${isProduction ? " no-environment-indicator" : ""}`}
            >
              {children}
            </div>
          </I18nProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
