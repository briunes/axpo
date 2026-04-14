import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";
import { parseAxpoExcel } from "@/infrastructure/excel/axpo-parser";

/**
 * @swagger
 * /api/v1/internal/base-values/upload:
 *   post:
 *     tags: [BaseValues]
 *     summary: Upload and import AXPO Excel price file
 *     description: Uploads an AXPO .xlsm file, parses it, and creates a new base value set
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The AXPO .xlsm pricing file
 *               replace:
 *                 type: boolean
 *                 description: If true, replaces items in existing set with same name (default false)
 *     responses:
 *       200:
 *         description: Successfully imported base values
 *       400:
 *         description: Invalid file or missing data
 *       401:
 *         description: Unauthorized
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const replace = formData.get("replace") === "true";

  if (!file) {
    throw new ValidationError("No file uploaded");
  }

  // Validate file extension
  if (!file.name.endsWith(".xlsm") && !file.name.endsWith(".xlsx")) {
    throw new ValidationError("File must be an Excel file (.xlsm or .xlsx)");
  }

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parse the Excel file
  let parsed;
  try {
    parsed = parseAxpoExcel(buffer, file.name);
  } catch (err) {
    throw new ValidationError(
      `Failed to parse Excel file: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  if (parsed.items.length === 0) {
    throw new ValidationError("No pricing data found in the Excel file");
  }

  // Check if a set with the same name exists
  const existing = await prisma.baseValueSet.findFirst({
    where: {
      name: parsed.name,
      scopeType: parsed.scopeType,
      agencyId: null,
      isDeleted: false,
    },
    orderBy: { version: "desc" },
  });

  let set;

  if (existing && replace) {
    // Replace mode: delete existing items and re-insert
    await prisma.$transaction([
      prisma.baseValueItem.deleteMany({
        where: { baseValueSetId: existing.id },
      }),
      prisma.baseValueItem.createMany({
        data: parsed.items.map((item) => ({
          baseValueSetId: existing.id,
          key: item.key,
          valueNumeric: item.valueNumeric ?? null,
          valueText: item.valueText ?? null,
          unit: item.unit ?? null,
        })),
      }),
    ]);

    set = await prisma.baseValueSet.update({
      where: { id: existing.id },
      data: {
        sourceWorkbookRef: parsed.sourceWorkbookRef,
        sourceScope: parsed.sourceScope,
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    // Deactivate ALL other base value sets (not just same name)
    await prisma.baseValueSet.updateMany({
      where: {
        id: { not: set.id },
        isActive: true,
        scopeType: parsed.scopeType,
        agencyId: null,
      },
      data: { isActive: false },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "UPDATE",
      targetType: "BaseValueSet",
      targetId: set.id,
      metadataJson: {
        action: "upload_replace",
        itemCount: parsed.items.length,
        filename: file.name,
      },
    });
  } else {
    // Create new version
    const nextVersion = existing ? existing.version + 1 : 1;

    set = await prisma.baseValueSet.create({
      data: {
        name: parsed.name,
        scopeType: parsed.scopeType,
        agencyId: null,
        sourceWorkbookRef: parsed.sourceWorkbookRef,
        sourceScope: parsed.sourceScope,
        version: nextVersion,
        isActive: true, // Always activate newly uploaded set
        createdBy: auth.userId,
        items: {
          create: parsed.items.map((item) => ({
            key: item.key,
            valueNumeric: item.valueNumeric ?? null,
            valueText: item.valueText ?? null,
            unit: item.unit ?? null,
          })),
        },
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "CREATE",
      targetType: "BaseValueSet",
      targetId: set.id,
      metadataJson: {
        action: "upload_create",
        version: nextVersion,
        itemCount: parsed.items.length,
        filename: file.name,
      },
    });

    // Deactivate ALL other base value sets to ensure simulations use latest
    await prisma.baseValueSet.updateMany({
      where: {
        id: { not: set.id },
        isActive: true,
        scopeType: parsed.scopeType,
        agencyId: null,
      },
      data: { isActive: false },
    });
  }

  return ResponseHandler.ok(
    {
      message: replace
        ? `Replaced ${parsed.items.length} items in existing set`
        : `Created new base value set v${set.version} with ${parsed.items.length} items`,
      set: {
        id: set.id,
        name: set.name,
        version: set.version,
        itemCount: set._count.items,
        isActive: set.isActive,
      },
    },
    replace ? 200 : 201,
  );
});
