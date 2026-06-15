import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../src/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";
import { ValidationError } from "@/domain/errors/errors";

export const dynamic = "force-dynamic";

const MAX_INVOICE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_INVOICE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * POST /api/v1/internal/simulations/upload-invoice
 * Uploads an invoice file and associates it with a simulation
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
    const auth = await requireAuth(req);
    await assertPermission(auth, "section.simulations");

    const formData = await req.formData();
    const file = formData.get("file");
    const simulationId = formData.get("simulationId");

    if (!(file instanceof File)) {
      throw new ValidationError("No invoice file provided");
    }

    if (typeof simulationId !== "string" || !simulationId) {
      throw new ValidationError("No simulation ID provided");
    }

    await SimulationService.assertSimulationAccess(auth, simulationId);

    if (!ALLOWED_INVOICE_TYPES.has(file.type)) {
      throw new ValidationError(
        "Invoice must be a PDF, JPEG, PNG, or WebP file",
      );
    }

    if (file.size <= 0 || file.size > MAX_INVOICE_SIZE_BYTES) {
      throw new ValidationError("Invoice file must be between 1 byte and 15 MB");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = file.name.replace(/[\r\n"]/g, "_").slice(0, 255);
    const mimeType = file.type;
    const fileSize = buffer.length;

    await prisma.simulation.update({
      where: { id: simulationId },
      data: {
        invoiceFileData: buffer,
        invoiceFileName: fileName,
        invoiceFileMimeType: mimeType,
        invoiceFileSize: fileSize,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice file uploaded successfully",
      fileName: fileName,
      fileSize: fileSize,
    });
});
