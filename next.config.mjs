import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Sentry instrumentation.ts to be loaded
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: [
    "bcrypt",
    "@prisma/client",
    "prisma",
    "@sparticuz/chromium",
    "puppeteer-core",
    "@napi-rs/canvas",
    "@opendataloader/pdf",
  ],

  
  // Ensure the Chromium brotli binaries (which live deep in pnpm's
  // node_modules layout) are included in the serverless function bundle.
  // Without this, Vercel's file-tracer doesn't follow the .pnpm symlinks
  // and the /bin directory is missing at runtime.
  outputFileTracingIncludes: {
    "/api/v1/internal/simulations/[id]/generate-pdf": [
      "./node_modules/.pnpm/@sparticuz+chromium@147.0.0/node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/v1/internal/invoices/extract": [
      "./node_modules/pdfjs-dist/legacy/build/**/*",
      "./node_modules/@opendataloader/pdf/dist/**/*",
      "./node_modules/@opendataloader/pdf/lib/**/*",
      "./node_modules/.pnpm/@opendataloader+pdf@2.4.7/node_modules/@opendataloader/pdf/dist/**/*",
      "./node_modules/.pnpm/@opendataloader+pdf@2.4.7/node_modules/@opendataloader/pdf/lib/**/*",
    ],
    "/api/v1/internal/invoices/detect-provider": [
      "./node_modules/pdfjs-dist/legacy/build/**/*",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-assets-eu.frontify.com",
        pathname: "/s3/frontify-enterprise-files-eu/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set in environment or here)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress verbose upload logs in CI
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Avoid Sentry crashing the build if DSN is missing
  // (useful for local dev without .env configured)
  errorHandler(err, invokeErr, compilation) {
    compilation.warnings.push("Sentry CLI: " + err.message);
  },
});
