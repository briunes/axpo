import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/v1/internal/invoice-providers
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const providers = await (prisma as any).invoiceProviderPrompt.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(providers);
});

// POST /api/v1/internal/invoice-providers
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const body = await req.json();
  const { name, prompt, isActive, needsPromptConfig } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { success: false, message: "Provider name is required" },
      { status: 400 },
    );
  }

  const slug = slugify(name);

  // Check for duplicate slug
  const existing = await (prisma as any).invoiceProviderPrompt.findUnique({
    where: { slug },
  });
  if (existing) {
    return NextResponse.json(
      {
        success: false,
        message: `A provider with the name "${name}" already exists`,
      },
      { status: 409 },
    );
  }

  const provider = await (prisma as any).invoiceProviderPrompt.create({
    data: {
      name: name.trim(),
      slug,
      prompt: prompt || "",
      isActive: isActive !== undefined ? isActive : true,
      needsPromptConfig:
        needsPromptConfig !== undefined ? needsPromptConfig : false,
    },
  });

  return NextResponse.json(provider, { status: 201 });
});
