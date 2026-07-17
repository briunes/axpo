import crypto from "crypto";
import fs from "fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const content = fs.readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    if (key === "DB_CONNECTION_MODE" && process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const allowedAppEnvs = new Set(["local", "dev", "preview", "development", "test"]);
const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "";

if (!allowedAppEnvs.has(appEnv)) {
  console.error(
    `Refusing to seed DEV notifications with APP_ENV/NODE_ENV="${appEnv}".`,
  );
  process.exit(1);
}

const now = new Date();
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60 * 1000);
const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const toCuidish = (value) =>
  `c${crypto.createHash("sha1").update(value).digest("hex")}`.slice(0, 25);

const samples = [
  {
    type: "app_errors.recent_5xx",
    category: "system_health",
    severity: "ERROR",
    title: "3 application errors in the last 24h",
    body: "TypeError: Cannot read properties of undefined while loading simulation totals.",
    sourceType: "app_error_logs",
    sourceId: "dev-app-error-simulation-totals",
    actionUrl: "/internal/logs?tab=app-errors",
    metadata: { count: 3, latestPath: "/api/v1/internal/simulations", latestStatusCode: 500 },
  },
  {
    type: "app_errors.recent_5xx",
    category: "system_health",
    severity: "CRITICAL",
    title: "18 application errors in the last 24h",
    body: "PrismaClientKnownRequestError: connection timeout while reading analytics.",
    sourceType: "app_error_logs",
    sourceId: "dev-app-error-analytics-timeout",
    actionUrl: "/internal/logs?tab=app-errors",
    metadata: { count: 18, latestPath: "/api/v1/internal/analytics/overview", latestStatusCode: 500 },
  },
  {
    type: "cron.failed",
    category: "automation",
    severity: "ERROR",
    title: "Cron job failed: expire-simulations",
    body: "Database lock timeout while expiring stale shared simulations.",
    sourceType: "cron_logs",
    sourceId: "dev-cron-expire-simulations",
    actionUrl: "/internal/logs?tab=cron",
    metadata: { executedAt: hoursAgo(2).toISOString(), status: "FAILED" },
  },
  {
    type: "cron.failed",
    category: "automation",
    severity: "ERROR",
    title: "Cron job failed: sync-preview-base-values",
    body: "Preview base-value import returned a validation error for tariff 3.0TD.",
    sourceType: "cron_logs",
    sourceId: "dev-cron-sync-preview-base-values",
    actionUrl: "/internal/logs?tab=cron",
    metadata: { executedAt: hoursAgo(5).toISOString(), status: "ERROR" },
  },
  {
    type: "email.failed_recent",
    category: "communications",
    severity: "WARNING",
    title: "2 email delivery issues in the last 24h",
    body: "Review SMTP delivery logs for failed or rejected simulation-share emails.",
    sourceType: "email_logs",
    sourceId: "dev-email-share-bounces",
    actionUrl: "/internal/email-logs",
    metadata: { count: 2, templateType: "simulation-share" },
  },
  {
    type: "email.failed_recent",
    category: "communications",
    severity: "ERROR",
    title: "7 email delivery issues in the last 24h",
    body: "SMTP rejected multiple setup-password and password-reset messages.",
    sourceType: "email_logs",
    sourceId: "dev-email-auth-rejections",
    actionUrl: "/internal/email-logs",
    metadata: { count: 7, smtpCode: "550" },
  },
  {
    type: "ocr.failed_recent",
    category: "integrations",
    severity: "WARNING",
    title: "1 OCR failure in the last 24h",
    body: "Provider detection failed for a low-resolution electricity invoice.",
    sourceType: "ocr_logs",
    sourceId: "dev-ocr-low-resolution-invoice",
    actionUrl: "/internal/logs?tab=ocr",
    metadata: { count: 1, provider: "openai", commodity: "ELECTRICITY" },
  },
  {
    type: "ocr.failed_recent",
    category: "integrations",
    severity: "ERROR",
    title: "6 OCR failures in the last 24h",
    body: "Several gas invoices failed parsing after provider detection succeeded.",
    sourceType: "ocr_logs",
    sourceId: "dev-ocr-gas-parse-errors",
    actionUrl: "/internal/logs?tab=ocr",
    metadata: { count: 6, provider: "openai", commodity: "GAS" },
  },
  {
    type: "ocr.issues_open",
    category: "operations",
    severity: "WARNING",
    title: "4 OCR issues awaiting review",
    body: "User-reported extraction issues are still open for electricity invoices.",
    sourceType: "ocr_logs",
    sourceId: "dev-ocr-open-electricity-issues",
    actionUrl: "/internal/logs?tab=ocr",
    metadata: { count: 4, issueStatus: "OPEN" },
  },
  {
    type: "ocr.issues_open",
    category: "operations",
    severity: "WARNING",
    title: "2 OCR issues in progress",
    body: "Reported gas invoice extraction issues are being investigated.",
    sourceType: "ocr_logs",
    sourceId: "dev-ocr-in-progress-gas-issues",
    actionUrl: "/internal/logs?tab=ocr",
    metadata: { count: 2, issueStatus: "IN_PROGRESS" },
  },
  {
    type: "invoice_provider.prompt_config_needed",
    category: "configuration",
    severity: "INFO",
    title: "5 provider prompts need configuration",
    body: "Auto-detected electricity invoice providers need prompt review before they are reliable.",
    sourceType: "invoice_provider_prompts",
    sourceId: "dev-provider-prompts-electricity",
    actionUrl: "/internal/configurations?tab=integrations",
    metadata: { count: 5, commodity: "ELECTRICITY" },
  },
  {
    type: "invoice_provider.prompt_config_needed",
    category: "configuration",
    severity: "INFO",
    title: "3 gas provider prompts need configuration",
    body: "New gas invoice providers were detected and need prompt setup.",
    sourceType: "invoice_provider_prompts",
    sourceId: "dev-provider-prompts-gas",
    actionUrl: "/internal/configurations?tab=integrations",
    metadata: { count: 3, commodity: "GAS" },
  },
  {
    type: "system.maintenance_active",
    category: "system_health",
    severity: "WARNING",
    title: "Maintenance mode is active",
    body: "Internal users can keep working, but public access is currently paused.",
    sourceType: "system_config",
    sourceId: "dev-maintenance-public-paused",
    actionUrl: "/internal/configurations?tab=system-business",
    metadata: { maintenanceUntil: hoursAgo(-3).toISOString(), scope: "public" },
  },
  {
    type: "system.maintenance_active",
    category: "system_health",
    severity: "WARNING",
    title: "Scheduled maintenance window starts soon",
    body: "A DEV maintenance window is configured for validation of the banner and notifications.",
    sourceType: "system_config",
    sourceId: "dev-maintenance-scheduled-window",
    actionUrl: "/internal/configurations?tab=system-business",
    metadata: { maintenanceUntil: hoursAgo(-8).toISOString(), scope: "internal" },
  },
];

async function main() {
  const rows = samples.map((sample, index) => {
    const dedupeKey = `dev:notification-sample:${sample.type}:${index + 1}`;
    const updatedAt = new Date().toISOString();
    return {
      id: toCuidish(dedupeKey),
      ...sample,
      audienceRole: "SYS_ADMIN",
      audienceUserId: null,
      dedupeKey,
      firstSeenAt: hoursAgo(12 - index * 0.5).toISOString(),
      lastSeenAt: minutesAgo(index * 7).toISOString(),
      resolvedAt: null,
      expiresAt: null,
      createdAt: updatedAt,
      updatedAt,
    };
  });

  if ((process.env.DB_CONNECTION_MODE ?? "direct").toLowerCase() === "api") {
    await upsertViaSupabaseDataApi(rows);
  } else {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      await Promise.all(
        rows.map((row) =>
          prisma.notification.upsert({
            where: { dedupeKey: row.dedupeKey },
            create: row,
            update: {
              ...row,
              createdAt: undefined,
            },
          }),
        ),
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`Seeded ${samples.length} DEV notification samples.`);
}

async function upsertViaSupabaseDataApi(rows) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;
  if (!supabaseUrl || !key) {
    throw new Error("DB_CONNECTION_MODE=api requires SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/notifications?on_conflict=dedupeKey`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Accept-Profile": schema,
        "Content-Profile": schema,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase Data API ${response.status} ${response.statusText}: ${await response.text()}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Failed to seed DEV notification samples", error);
    process.exit(1);
  })
  .finally(async () => {
    // Connections are closed in the selected database-mode branch.
  });
