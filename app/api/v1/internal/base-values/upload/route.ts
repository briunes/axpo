import crypto from "crypto";
import { del, get } from "@vercel/blob";
import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import {
  buildAxpoImportProfileFromConfigs,
  defaultExcelParserProductConfigs,
  withMissingDefaultExcelParserProductConfigs,
  type ExcelParserConfigScope,
  type ExcelParserProductConfigItem,
} from "@/domain/excelParserProductConfig";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { AuditService } from "@/application/services/auditService";
import {
  inferAxpoImportScope,
  parseAxpoExcel,
} from "@/infrastructure/excel/axpo-parser";
import {
  isBaseValueWorkbookFileName,
  isVercelBlobUrl,
  MAX_BASE_VALUE_WORKBOOK_SIZE,
} from "@/infrastructure/excel/baseValueUpload";

const blobUploadSchema = z.object({
  blobUrl: z.string().url().refine(isVercelBlobUrl),
  fileName: z.string().min(1),
  replace: z.boolean().optional().default(false),
  scopeType: z.enum(["GLOBAL", "TLV"]).optional(),
});

export const maxDuration = 60;

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

  let fileName: string;
  const replace = false;
  let scopeType: ExcelParserConfigScope | undefined;
  let buffer: Buffer;
  let temporaryBlobUrl: string | null = null;

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const payload = blobUploadSchema.safeParse(await request.json());
      if (!payload.success) {
        throw new ValidationError("Invalid Blob upload details");
      }

      fileName = payload.data.fileName;
      scopeType = payload.data.scopeType;
      temporaryBlobUrl = payload.data.blobUrl;

      const blob = await get(temporaryBlobUrl, {
        access: "private",
        useCache: false,
      });
      if (!blob || blob.statusCode !== 200) {
        throw new ValidationError("Uploaded Excel file could not be retrieved");
      }
      if (blob.blob.size > MAX_BASE_VALUE_WORKBOOK_SIZE) {
        throw new ValidationError("Excel file exceeds the 50 MB upload limit");
      }

      buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());
    } else {
      // Retain multipart support for local tools and files below Vercel's limit.
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new ValidationError("No file uploaded");
      }

      fileName = file.name;
      const formScopeType = formData.get("scopeType");
      scopeType =
        formScopeType === "GLOBAL" || formScopeType === "TLV"
          ? formScopeType
          : undefined;
      if (file.size > MAX_BASE_VALUE_WORKBOOK_SIZE) {
        throw new ValidationError("Excel file exceeds the 50 MB upload limit");
      }
      buffer = Buffer.from(await file.arrayBuffer());
    }

    if (!isBaseValueWorkbookFileName(fileName)) {
      throw new ValidationError("File must be an Excel file (.xlsm or .xlsx)");
    }

    const resolvedScopeType = scopeType ?? inferAxpoImportScope(fileName);
    const profile = buildAxpoImportProfileFromConfigs(
      resolvedScopeType,
      await loadParserConfig(resolvedScopeType),
    );

    // Parse the Excel file
    let parsed;
    try {
      parsed = await parseAxpoExcel(buffer, fileName, {
        scopeType: resolvedScopeType,
        profile,
      });
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
      const replacementItems = parsed.items.map((item) => ({
        id: crypto.randomUUID(),
        key: item.key,
        valueNumeric: item.valueNumeric ?? null,
        valueText: item.valueText ?? null,
        unit: item.unit ?? null,
        effectiveFrom: null,
        effectiveTo: null,
      }));
      if (isSupabaseApiMode()) {
        await (prisma as any).$rpc("axpo_replace_base_value_items", {
          p_base_value_set_id: existing.id,
          p_items: replacementItems,
          p_now: new Date(),
        });
      } else {
        await prisma.$transaction([
          prisma.baseValueItem.deleteMany({
            where: { baseValueSetId: existing.id },
          }),
          prisma.baseValueItem.createMany({
            data: replacementItems.map(({ id: _id, ...item }) => ({
              baseValueSetId: existing.id,
              ...item,
            })),
          }),
        ]);
      }

      set = await prisma.baseValueSet.update({
        where: { id: existing.id },
        data: {
          sourceWorkbookRef: parsed.sourceWorkbookRef,
          sourceScope: parsed.sourceScope,
          sourceFileName: fileName,
          sourceFileData: buffer,
          updatedAt: new Date(),
        },
        include: {
          _count: { select: { items: true } },
        },
      });

      await AuditService.logEvent({
        actorUserId: auth.userId,
        eventType: "UPDATE",
        targetType: "BaseValueSet",
        targetId: set.id,
        metadataJson: {
          action: "upload_replace",
          itemCount: parsed.items.length,
          filename: fileName,
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
          sourceFileName: fileName,
          sourceFileData: buffer,
          version: nextVersion,
          isActive: false, // Uploaded sets start as Draft; activate manually
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
          filename: fileName,
        },
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
  } finally {
    if (temporaryBlobUrl) {
      await del(temporaryBlobUrl).catch(() => {});
    }
  }
});

async function loadParserConfig(
  scopeType: ExcelParserConfigScope,
): Promise<ExcelParserProductConfigItem[]> {
  const rows = await prisma.excelParserProductConfig.findMany({
    where: { scopeType },
    orderBy: [{ sortOrder: "asc" }, { sourceLabel: "asc" }],
  });

  if (rows.length === 0) {
    return defaultExcelParserProductConfigs(scopeType);
  }

  return withMissingDefaultExcelParserProductConfigs(
    scopeType,
    rows.map((row) => ({
      id: row.id,
      scopeType: row.scopeType as ExcelParserProductConfigItem["scopeType"],
      sourceLabel: row.sourceLabel,
      productKey: row.productKey,
      displayName: row.displayName,
      commodity: row.commodity as ExcelParserProductConfigItem["commodity"],
      pricingType: row.pricingType as ExcelParserProductConfigItem["pricingType"],
      enabled: row.enabled,
      singlePeriod: row.singlePeriod,
      eligibilityMin: row.eligibilityMin?.toNumber() ?? null,
      eligibilityMax: row.eligibilityMax?.toNumber() ?? null,
      sortOrder: row.sortOrder,
    })),
  );
}
