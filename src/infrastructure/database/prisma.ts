import { PrismaClient } from "@prisma/client";
import { getDatabaseConnectionMode } from "./databaseMode";
import { createSupabaseApiPrismaClient } from "./supabaseApiClient";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Log query timing in dev/preview to help identify slow queries.
// In production (Vercel), only log errors.
const isLocal =
  process.env.APP_ENV === "local" || process.env.NODE_ENV === "development";
const isRemoteDev =
  process.env.APP_ENV === "dev" || process.env.APP_ENV === "preview";
const databaseConnectionMode = getDatabaseConnectionMode();

const createDatabaseClient = (): PrismaClient => {
  if (databaseConnectionMode === "api") {
    return createSupabaseApiPrismaClient() as PrismaClient;
  }

  return new PrismaClient({
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
};

export const prisma =
  databaseConnectionMode === "api"
    ? createDatabaseClient()
    : (globalForPrisma.prisma ?? createDatabaseClient());

// The direct Prisma client needs a development singleton to avoid connection
// churn. The stateless API adapter must be recreated so hot reloads pick up
// relation and serialization changes.
if (process.env.NODE_ENV !== "production" && databaseConnectionMode === "direct") {
  globalForPrisma.prisma = prisma;
}
