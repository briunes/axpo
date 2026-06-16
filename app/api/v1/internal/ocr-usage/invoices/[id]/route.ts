import { NextRequest } from "next/server";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/ocr-usage/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get a single OCR usage invoice snapshot
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.ocr-usage");

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Invoice id is required");

    const inv = await prisma.ocrUsageInvoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        agency: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!inv) throw new NotFoundError("Invoice not found");

    return ResponseHandler.ok({
      id: inv.id,
      label: inv.label,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      clientId: inv.clientId,
      clientName: inv.clientName ?? inv.client?.name ?? null,
      agencyId: inv.agencyId,
      agencyName: inv.agency?.name ?? null,
      userId: inv.userId,
      userName: inv.user?.fullName ?? null,
      userEmail: inv.user?.email ?? null,
      currency: inv.currency,
      totalCalls: inv.totalCalls,
      successfulCalls: inv.successfulCalls,
      failedCalls: inv.failedCalls,
      totalPromptTokens: Number(inv.totalPromptTokens),
      totalCompletionTokens: Number(inv.totalCompletionTokens),
      totalTokens: Number(inv.totalTokens),
      baseCost: Number(inv.baseCost),
      markupCost: Number(inv.markupCost),
      fixedFeeCost: Number(inv.fixedFeeCost),
      totalCost: Number(inv.totalCost),
      breakdown: inv.breakdown ?? null,
      status: inv.status,
      note: inv.note ?? null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      createdBy: inv.createdByUser
        ? {
            id: inv.createdByUser.id,
            fullName: inv.createdByUser.fullName,
            email: inv.createdByUser.email,
          }
        : null,
    });
  },
);
