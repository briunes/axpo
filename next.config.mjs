/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "bcrypt",
    "@prisma/client",
    "prisma",
    "@sparticuz/chromium",
    "puppeteer-core",
    "@napi-rs/canvas",
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
};

export default nextConfig;
