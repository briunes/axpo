import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../src/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/internal/simulations/[id]/invoice
 * Downloads the invoice file associated with a simulation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: simulationId } = await params;

    // Get simulation with invoice file data
    const simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
      select: {
        invoiceFileData: true,
        invoiceFileName: true,
        invoiceFileMimeType: true,
        // Fallback to old file path system for backwards compatibility
        invoiceFilePath: true,
      },
    });

    if (!simulation) {
      return NextResponse.json(
        { success: false, message: "Simulation not found" },
        { status: 404 },
      );
    }

    // Check if file data exists in database
    if (simulation.invoiceFileData && simulation.invoiceFileName) {
      const fileBuffer = Buffer.from(simulation.invoiceFileData);
      const contentType =
        simulation.invoiceFileMimeType || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${simulation.invoiceFileName}"`,
        },
      });
    }

    // Fallback: check old file path system (for backwards compatibility)
    if (simulation.invoiceFilePath) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice file stored in old format. Please re-upload the invoice.",
        },
        { status: 410 }, // 410 Gone - indicates the resource is no longer available
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "No invoice file found for this simulation",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("Invoice download error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to download invoice file",
      },
      { status: 500 },
    );
  }
}
