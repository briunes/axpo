import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { OcrPromptImprovementService } from "@/application/services/ocrPromptImprovementService";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Cron job endpoint to create reviewable OCR prompt improvements from recent
 * user corrections.
 *
 * Security: Protected by CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Cron] Unauthorized attempt to run OCR prompt improvement job");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const hours = Math.max(Number(searchParams.get("hours") ?? 24), 1);
    const maxAttempts = Math.max(Number(searchParams.get("maxAttempts") ?? 3), 1);
    const maxLogsPerProvider = Math.max(
      Number(searchParams.get("maxLogsPerProvider") ?? 5),
      1,
    );
    const minimumCorrectionsPerProvider = Math.max(
      Number(searchParams.get("minimumCorrectionsPerProvider") ?? 1),
      1,
    );

    console.log("[Cron] Starting OCR prompt improvement job...", {
      hours,
      maxAttempts,
      maxLogsPerProvider,
      minimumCorrectionsPerProvider,
    });

    const result = await OcrPromptImprovementService.runRecentCorrectionsBatch({
      since: new Date(Date.now() - hours * 60 * 60 * 1000),
      maxAttempts,
      maxLogsPerProvider,
      minimumCorrectionsPerProvider,
    });

    const duration = Date.now() - startTime;

    await prisma.cronLog
      .create({
        data: {
          jobName: "ocr-prompt-improvements",
          jobType: "OCR_PROMPT_IMPROVEMENT",
          status: "SUCCESS",
          duration,
          totalProcessed: result.totalSourceLogs,
          totalAffected: result.proposalsCreated,
          metadata: {
            source: "api",
            hours,
            maxAttempts,
            maxLogsPerProvider,
            minimumCorrectionsPerProvider,
            result,
          } as Prisma.InputJsonValue,
        },
      })
      .catch((error) => {
        console.error("[Cron] Failed to log OCR prompt improvement execution:", error);
      });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Cron] Error during OCR prompt improvement:", error);

    await prisma.cronLog
      .create({
        data: {
          jobName: "ocr-prompt-improvements",
          jobType: "OCR_PROMPT_IMPROVEMENT",
          status: "FAILED",
          duration,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          metadata: { source: "api" },
        },
      })
      .catch((logError) => {
        console.error("[Cron] Failed to log OCR prompt improvement error:", logError);
      });

    return NextResponse.json(
      {
        success: false,
        error: "OCR prompt improvement job failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
