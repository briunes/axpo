import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/ocr-logs/{id}/report:
 *   patch:
 *     tags: [Invoices]
 *     summary: Report an issue for an OCR log entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Issue message reported by the user
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    const id = context?.params?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing OCR log ID" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const message: string | undefined = body?.message;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, message: "A non-empty message is required" },
        { status: 400 },
      );
    }

    // Make sure the log belongs to the requesting user (or is an admin)
    const log = await prisma.ocrLog.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!log) {
      return NextResponse.json(
        { success: false, message: "OCR log not found" },
        { status: 404 },
      );
    }

    if (log.userId && log.userId !== auth.userId) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      );
    }

    const updated = await prisma.ocrLog.update({
      where: { id },
      data: {
        reportedIssue: message.trim(),
        issueStatus: "OPEN",
        issueSubmittedAt: new Date(),
        issueResolution: null,
        issueHandledAt: null,
        issueHandledByUserId: null,
      },
      select: {
        id: true,
        reportedIssue: true,
        issueStatus: true,
        issueSubmittedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  },
);
