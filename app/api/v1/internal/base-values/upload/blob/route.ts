import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/domain/types";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import {
  BASE_VALUE_WORKBOOK_CONTENT_TYPES,
  isBaseValueWorkbookFileName,
} from "@/infrastructure/excel/baseValueUpload";
import { getConfiguredMaxUploadFileSizeBytes } from "@/application/config/uploadLimits";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const auth = await requireAuth(request);
        assertRole(auth, [UserRole.ADMIN]);

        if (
          !pathname.startsWith("base-values/") ||
          !isBaseValueWorkbookFileName(pathname)
        ) {
          throw new Error("Only .xlsm and .xlsx base value files are allowed");
        }
        const maximumSizeInBytes = await getConfiguredMaxUploadFileSizeBytes();

        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: BASE_VALUE_WORKBOOK_CONTENT_TYPES,
            maximumSizeInBytes,
            validUntil: Date.now() + 5 * 60 * 1000,
          }),
          urlOptions: {
            allowedContentTypes: BASE_VALUE_WORKBOOK_CONTENT_TYPES,
            maximumSizeInBytes,
            tokenPayload: JSON.stringify({ userId: auth.userId }),
          },
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Base value blob upload authorization failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error: "Could not authorize upload",
      },
      { status: 400 },
    );
  }
}
