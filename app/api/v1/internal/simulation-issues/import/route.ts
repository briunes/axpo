import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { ForbiddenError, ValidationError } from "@/domain/errors/errors";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { MAX_ISSUE_TRANSFER_BYTES, SimulationIssueTransferService } from "@/application/services/simulationIssueTransferService";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  if (auth.role !== UserRole.SYS_ADMIN) throw new ForbiddenError("Only sys admins can import incidents");
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError("An incident export file is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_ISSUE_TRANSFER_BYTES) {
      await reader.cancel();
      throw new ValidationError("Incident imports must not exceed 100 MB");
    }
    chunks.push(value);
  }
  let archive: unknown;
  try { archive = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ValidationError("The file is not valid incident export JSON"); }
  const preview = request.nextUrl.searchParams.get("preview") === "true";
  return ResponseHandler.ok(await SimulationIssueTransferService.import(archive, auth.userId, preview));
});
