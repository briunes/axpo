import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { JwtService } from "@/application/services/jwtService";
import { SessionService } from "@/application/services/sessionService";
import {
  INVOICE_UPLOAD_CONTENT_TYPES,
  isInvoiceFileName,
  MAX_INVOICE_UPLOAD_SIZE,
} from "@/infrastructure/invoices/invoiceUpload";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get("token");

    const authPromise = (async () => {
      const authorizationHeader = request.headers.get("authorization");
      if (authorizationHeader) {
        return requireAuth(request);
      }

      if (!tokenParam) {
        throw new Error("Missing Authorization header");
      }

      const payload = JwtService.verifyAccessToken(tokenParam);
      const activeSession = await SessionService.ensureSessionIsActive(
        payload.sub,
        payload.sid,
      );

      if (!activeSession) {
        throw new Error("Session expired or revoked");
      }

      SessionService.touchSession(payload.sid).catch(() => {});

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        role: payload.role,
        agencyId: payload.agencyId,
        email: payload.email,
      };
    })();

    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const auth = await authPromise;
        await assertPermission(auth, "section.simulations");

        if (!pathname.startsWith("invoices/") || !isInvoiceFileName(pathname)) {
          throw new Error("Only PDF, JPEG, PNG, and WebP invoices are allowed");
        }

        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: INVOICE_UPLOAD_CONTENT_TYPES,
            maximumSizeInBytes: MAX_INVOICE_UPLOAD_SIZE,
            validUntil: Date.now() + 5 * 60 * 1000,
          }),
          urlOptions: {
            allowedContentTypes: INVOICE_UPLOAD_CONTENT_TYPES,
            maximumSizeInBytes: MAX_INVOICE_UPLOAD_SIZE,
            tokenPayload: JSON.stringify({ userId: auth.userId }),
          },
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Invoice blob upload authorization failed:", errorMessage);

    return NextResponse.json(
      { error: "Could not authorize upload: " + errorMessage },
      { status: 400 },
    );
  }
}
