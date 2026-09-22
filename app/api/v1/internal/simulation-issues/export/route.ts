import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ForbiddenError } from "@/domain/errors/errors";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { SimulationIssueTransferService } from "@/application/services/simulationIssueTransferService";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  // assertRole treats ADMIN as elevated, so a strict check is required here.
  if (auth.role !== UserRole.SYS_ADMIN) throw new ForbiddenError("Only sys admins can export incidents");
  const ids = z.array(z.string().min(1).max(200)).min(1).max(100).parse(request.nextUrl.searchParams.getAll("id"));
  const json = await SimulationIssueTransferService.export({ id: { in: [...new Set(ids)] } });
  return new NextResponse(json, { headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="simulation-incidents-${new Date().toISOString().slice(0, 10)}.json"`,
  } });
});
