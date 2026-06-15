import { NextRequest } from "next/server";
import { withErrorHandler } from "../errorHandler";
import { ResponseHandler } from "../response";

const mockCaptureError = jest.fn();

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: {
    capture: (...args: unknown[]) => mockCaptureError(...args),
  },
}));

describe("API app version handshake", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureError.mockResolvedValue(undefined);
    globalThis.__axpoAppVersionCache = {
      version: "1.0.0",
      loadedAt: Date.now(),
    };
  });

  afterEach(() => {
    globalThis.__axpoAppVersionCache = null;
  });

  it("rejects an API request from an older frontend version", async () => {
    const handler = withErrorHandler(async () =>
      ResponseHandler.ok({ reachedHandler: true }),
    );
    const request = new NextRequest("http://localhost/api/v1/internal/test", {
      headers: {
        "x-axpo-app-version": "0.9.0",
      },
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toEqual({
      code: "APP_VERSION_OUTDATED",
      message: "A newer application version is available",
      details: {
        frontendVersion: "0.9.0",
        currentVersion: "1.0.0",
      },
    });
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ApiResponseError",
        code: "APP_VERSION_OUTDATED",
      }),
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/internal/test",
        statusCode: 409,
        sendToSentry: false,
      }),
    );
  });

  it("records both the API endpoint and originating browser route", async () => {
    const handler = withErrorHandler(async () =>
      ResponseHandler.error(
        "VALIDATION_ERROR",
        "Invoice extraction failed",
        400,
      ),
    );
    const request = new NextRequest(
      "http://localhost/api/v1/internal/invoices/extract",
      {
        method: "POST",
        headers: {
          "x-axpo-page-path": "/internal/simulations/new",
        },
      },
    );

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ApiResponseError",
        code: "VALIDATION_ERROR",
      }),
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/internal/invoices/extract",
        pagePath: "/internal/simulations/new",
        statusCode: 400,
        sendToSentry: false,
      }),
    );
  });

  it("allows requests from the current frontend version", async () => {
    const handler = withErrorHandler(async () =>
      ResponseHandler.ok({ reachedHandler: true }),
    );
    const request = new NextRequest("http://localhost/api/v1/internal/test", {
      headers: {
        "x-axpo-app-version": "1.0.0",
      },
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ reachedHandler: true });
  });

  it("does not reject requests when the backend version could not be loaded", async () => {
    globalThis.__axpoAppVersionCache = null;
    const handler = withErrorHandler(async () =>
      ResponseHandler.ok({ reachedHandler: true }),
    );
    const request = new NextRequest("http://localhost/api/v1/internal/test", {
      headers: {
        "x-axpo-app-version": "9.9.9",
      },
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ reachedHandler: true });
  });
});
