import { ReactNode } from "react";
import { I18nProvider } from "../src/lib/i18n-context";

import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "./env-indicator.css";

export const metadata = {
  title: "AXPO Simulator",
  description: "AXPO Simulador",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const vercelEnv = process.env.VERCEL_ENV ?? "development";
  const isProduction = vercelEnv === "production";
  const envLabel = isProduction ? "PRD / PRODUCTION" : "DEV / PREVIEW";

  return (
    <html lang="en" data-theme="light" data-brand="custom" data-accent="custom" data-neutral="gray">
      <body>
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
