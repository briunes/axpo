import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Log query timing in dev/preview to help identify slow queries.
// In production (Vercel), only log errors.
const isLocal =
  process.env.APP_ENV === "local" || process.env.NODE_ENV === "development";
const isRemoteDev =
  process.env.APP_ENV === "dev" || process.env.APP_ENV === "preview";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isLocal
      ? ["error", "warn"]
      : isRemoteDev
        ? [
            { emit: "stdout", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : ["error"],
  });

// Cache singleton in all non-production envs to avoid repeated client initialisation
// on Next.js hot reload (dev server) or between requests in the same process.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
