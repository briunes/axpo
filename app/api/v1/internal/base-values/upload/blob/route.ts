import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import {
  BASE_VALUE_WORKBOOK_CONTENT_TYPES,
  isBaseValueWorkbookFileName,
  MAX_BASE_VALUE_WORKBOOK_SIZE,
} from "@/infrastructure/excel/baseValueUpload";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const auth = await requireAuth(request);
        assertRole(auth, [UserRole.ADMIN]);

        if (
          !pathname.startsWith("base-values/") ||
          !isBaseValueWorkbookFileName(pathname)
        ) {
          throw new Error("Only .xlsm and .xlsx base value files are allowed");
        }

        return {
          allowedContentTypes: BASE_VALUE_WORKBOOK_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BASE_VALUE_WORKBOOK_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: auth.userId }),
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not authorize upload",
      },
      { status: 400 },
    );
  }
}
