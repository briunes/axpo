import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { ValidationError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";

export const GET = withErrorHandler(async (request: NextRequest, context?: { params?: Record<string, string> }) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.simulation-issues");
  const id = context?.params?.id;
  const fileId = context?.params?.fileId;
  if (!id || !fileId) throw new ValidationError("File is required");
  const file = fileId === "snapshot"
    ? await prisma.simulationIssue.findUnique({ where: { id }, select: { snapshotFileName: true, snapshotMimeType: true, snapshotFileData: true } })
    : await prisma.simulationIssueAttachment.findFirst({ where: { id: fileId, issueId: id }, select: { fileName: true, mimeType: true, fileData: true } });
  if (!file) throw new ValidationError("File not found");
  const fileName = "snapshotFileName" in file ? file.snapshotFileName : file.fileName;
  const mimeType = "snapshotMimeType" in file ? file.snapshotMimeType : file.mimeType;
  const data = "snapshotFileData" in file ? file.snapshotFileData : file.fileData;
  return new NextResponse(Buffer.from(data) as unknown as BodyInit, { headers: {
    "Content-Type": mimeType, "Content-Disposition": `attachment; filename="${fileName.replace(/[\r\n"]/g, "_")}"`,
    "Content-Length": data.length.toString(),
  }});
});
