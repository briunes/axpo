import cron, { ScheduledTask } from "node-cron";
import { SimulationExpirationService } from "@/application/services/simulationExpirationService";
import { prisma } from "@/infrastructure/database/prisma";

let isInitialized = false;
let expirationTask: ScheduledTask | null = null;

/**
 * Load cron configuration from database
 */
async function loadCronConfig() {
  try {
    const config = await prisma.systemConfig.findFirst();
    return {
      enabled: config?.cronExpirationEnabled ?? true,
      schedule: config?.cronExpirationSchedule ?? "0 2 * * *",
      timezone: config?.cronExpirationTimezone ?? "UTC",
    };
  } catch (error) {
    console.warn(
      "[Cron] Failed to load config from database, using defaults:",
      error,
    );
    return {
      enabled: true,
      schedule: "0 2 * * *",
      timezone: "UTC",
    };
  }
}

/**
 * Initialize all cron jobs for the application
 * This runs in-process and works in any environment (local, Vercel, Docker, etc.)
 */
export async function initializeCronJobs() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log("[Cron] Jobs already initialized, skipping...");
    return;
  }

  console.log("[Cron] Initializing cron jobs...");

  // Load configuration from database
  const config = await loadCronConfig();

  if (!config.enabled) {
    console.log(
      "[Cron] Simulation expiration cron is disabled in system configuration",
    );
    isInitialized = true;
    return;
  }

  // Validate cron expression
  if (!cron.validate(config.schedule)) {
    console.error(
      `[Cron] Invalid cron schedule expression: "${config.schedule}", using default`,
    );
    config.schedule = "0 2 * * *";
  }

  console.log(
    `[Cron] Scheduling simulation expiration: "${config.schedule}" (${config.timezone})`,
  );

  // Schedule simulation expiration job
  expirationTask = cron.schedule(
    config.schedule,
    async () => {
      console.log("[Cron] Running scheduled simulation expiration job...");
      const startTime = Date.now();

      try {
        const result = await SimulationExpirationService.expireSimulations();
        const duration = Date.now() - startTime;

        console.log("[Cron] Simulation expiration completed:", {
          totalExpired: result.totalExpired,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString(),
        });

        // Log to cron logs
        await prisma.cronLog
          .create({
            data: {
              jobName: "simulation-expiration",
              jobType: "EXPIRATION",
              status: "SUCCESS",
              duration: duration,
              totalProcessed: result.totalExpired,
              totalAffected: result.totalExpired,
              metadata: {
                expiredIds: result.expiredIds,
                schedule: config.schedule,
                timezone: config.timezone,
              },
            },
          })
          .catch((error) => {
            console.error("[Cron] Failed to log execution:", error);
          });
      } catch (error) {
        console.error("[Cron] Error during simulation expiration:", error);

        // Log error to cron logs
        await prisma.cronLog
          .create({
            data: {
              jobName: "simulation-expiration",
              jobType: "EXPIRATION",
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              metadata: {
                schedule: config.schedule,
                timezone: config.timezone,
              },
            },
          })
          .catch((logError) => {
            console.error("[Cron] Failed to log error:", logError);
          });
      }
    },
    {
      timezone: config.timezone,
    },
  );

  // Optional: Run immediately on startup in development (for testing)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.RUN_CRON_ON_STARTUP === "true"
  ) {
    console.log(
      "[Cron] Running expiration job on startup (development mode)...",
    );
    SimulationExpirationService.expireSimulations()
      .then((result) => {
        console.log("[Cron] Startup expiration completed:", result);
      })
      .catch((error) => {
        console.error("[Cron] Error during startup expiration:", error);
      });
  }

  isInitialized = true;
  console.log("[Cron] All cron jobs initialized successfully");
}

/**
 * Reload cron configuration and restart jobs
 * Call this after updating system configuration
 */
export async function reloadCronJobs() {
  console.log("[Cron] Reloading cron jobs...");
  stopCronJobs();
  isInitialized = false;
  await initializeCronJobs();
}

/**
 * Stop all cron jobs (useful for testing or graceful shutdown)
 */
export function stopCronJobs() {
  cron.getTasks().forEach((task) => {
    task.stop();
  });
  isInitialized = false;
  console.log("[Cron] All cron jobs stopped");
}
