import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../src/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/internal/simulations/upload-invoice
 * Uploads an invoice file and associates it with a simulation
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const simulationId = formData.get("simulationId") as string;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 },
      );
    }

    if (!simulationId) {
      return NextResponse.json(
        { success: false, message: "No simulation ID provided" },
        { status: 400 },
      );
    }

    // Verify simulation exists
    const simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
    });

    if (!simulation) {
      return NextResponse.json(
        { success: false, message: "Simulation not found" },
        { status: 404 },
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get file metadata
    const fileName = file.name;
    const mimeType = file.type || "application/octet-stream";
    const fileSize = buffer.length;

    // Save file data to database
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
  } catch (error) {
    console.error("Invoice upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to upload invoice file",
      },
      { status: 500 },
    );
  }
}
