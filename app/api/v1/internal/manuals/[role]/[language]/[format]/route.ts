import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ForbiddenError, NotFoundError } from "@/domain/errors/errors";
import {
  canDownloadUserManual,
  resolveUserManual,
} from "@/application/manuals/userManuals";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (
  request: NextRequest,
  context?: { params?: Record<string, string> },
) => {
  const auth = await requireAuth(request);
  const params = context?.params ?? {};
  const manual = resolveUserManual(params.role, params.language, params.format);

  if (!manual) throw new NotFoundError("User manual");
  if (!canDownloadUserManual(auth.role, manual.role)) {
    throw new ForbiddenError("You cannot download a manual for another role");
  }

  const filePath = path.join(process.cwd(), "resources", "user-manuals", manual.fileName);
  const data = await readFile(filePath).catch(() => null);
  if (!data) throw new NotFoundError("User manual");

  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": manual.contentType,
      "Content-Disposition": `attachment; filename="${manual.fileName}"`,
      "Content-Length": data.length.toString(),
      // Manuals are replaced in-place when documentation is revised. Avoid
      // serving an older role manual from the browser or an intermediary cache.
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});
