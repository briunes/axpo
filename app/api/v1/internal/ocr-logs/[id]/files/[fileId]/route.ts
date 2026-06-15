import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async (request: NextRequest, context) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.ocr-logs");

  const id = context?.params?.id;
  const fileId = context?.params?.fileId;

  if (!id || !fileId) {
    return NextResponse.json(
      { success: false, message: "Missing OCR file parameters" },
      { status: 400 },
    );
  }

  const file = await (prisma as any).ocrLogFile.findFirst({
    where: {
      id: fileId,
      ocrLogId: id,
    },
    select: {
      fileData: true,
      fileName: true,
      fileType: true,
    },
  });

  if (!file) {
    return NextResponse.json(
      { success: false, message: "OCR file not found" },
      { status: 404 },
    );
  }

  return new NextResponse(Buffer.from(file.fileData), {
    headers: {
      "Content-Type": file.fileType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
