import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const escapePdfText = (text: string): string => {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
};

const buildSimplePdf = (lines: string[]): Buffer => {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...lines.map((line, index) => (index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -18 Td (${escapePdfText(line)}) Tj`)),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
};

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/pdf:
 *   get:
 *     tags: [Simulations]
 *     summary: Generate a simulation PDF snapshot
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
    });

    const pdf = buildSimplePdf([
      `AXPO Simulation Snapshot`,
      `Simulation ID: ${simulation.id}`,
      `Status: ${simulation.status}`,
      `Shared At: ${simulation.sharedAt ? simulation.sharedAt.toISOString() : "N/A"}`,
      `Expires At: ${simulation.expiresAt ? simulation.expiresAt.toISOString() : "N/A"}`,
      `Latest Version: ${latestVersion?.id ?? "N/A"}`,
    ]);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=simulation-${simulation.id}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  }
);
