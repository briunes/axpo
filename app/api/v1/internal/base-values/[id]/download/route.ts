import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { ValidationError } from "@/domain/errors/errors";

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const params = context?.params ?? {};
    await requireAuth(request);

    const set = await prisma.baseValueSet.findFirst({
      where: { id: params.id, isDeleted: false },
      select: { sourceFileName: true, sourceFileData: true },
    });

    if (!set) {
      throw new ValidationError("Base value set not found");
    }

    if (!set.sourceFileData || !set.sourceFileName) {
      throw new ValidationError("No file available for this base value set");
    }

    const contentType = "application/vnd.ms-excel.sheet.macroEnabled.12";

    return new NextResponse(set.sourceFileData as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${set.sourceFileName}"`,
        "Content-Length": set.sourceFileData.length.toString(),
      },
    });
  },
);
