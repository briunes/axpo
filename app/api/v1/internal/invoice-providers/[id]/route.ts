import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";

// GET /api/v1/internal/invoice-providers/[id]
export const GET = withErrorHandler(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    await requireAuth(req);

    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Provider id is required" },
        { status: 400 },
      );
    }

    const provider = await (prisma as any).invoiceProviderPrompt.findUnique({
      where: { id },
    });

    if (!provider) {
      return NextResponse.json(
        { success: false, message: "Provider not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(provider);
  },
);

// PUT /api/v1/internal/invoice-providers/[id]
export const PUT = withErrorHandler(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    await requireAuth(req);

    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Provider id is required" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { name, prompt, isActive, needsPromptConfig } = body;

    const existing = await (prisma as any).invoiceProviderPrompt.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Provider not found" },
        { status: 404 },
      );
    }

    // Auto-clear needsPromptConfig when a real prompt is being saved
    const autoNeedsPromptConfig =
      needsPromptConfig !== undefined
        ? needsPromptConfig
        : prompt !== undefined && prompt.trim().length > 0
          ? false
          : undefined;

    const updated = await (prisma as any).invoiceProviderPrompt.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(prompt !== undefined && { prompt }),
        ...(isActive !== undefined && { isActive }),
        ...(autoNeedsPromptConfig !== undefined && {
          needsPromptConfig: autoNeedsPromptConfig,
        }),
      },
    });

    return NextResponse.json(updated);
  },
);

// DELETE /api/v1/internal/invoice-providers/[id]
export const DELETE = withErrorHandler(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    await requireAuth(req);

    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Provider id is required" },
        { status: 400 },
      );
    }

    const existing = await (prisma as any).invoiceProviderPrompt.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Provider not found" },
        { status: 404 },
      );
    }

    await (prisma as any).invoiceProviderPrompt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Provider deleted" });
  },
);
