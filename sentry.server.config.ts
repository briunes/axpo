import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",

  // Capture 100% of transactions in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: process.env.NODE_ENV === "development",
});
