const createAppErrorMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    appErrorLog: {
      create: (...args: unknown[]) => createAppErrorMock(...args),
    },
  },
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  flush: jest.fn(),
}));

import { ErrorLoggerService } from "../errorLoggerService";

describe("ErrorLoggerService during Supabase API schema rollouts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries without pagePath when PostgREST has not loaded the new column", async () => {
    createAppErrorMock
      .mockRejectedValueOnce(
        new Error(
          `Supabase Data API 400 Bad Request: {"code":"PGRST204","message":"Could not find the 'pagePath' column of 'app_error_logs' in the schema cache"}`,
        ),
      )
      .mockResolvedValueOnce({ id: "error-1" });

    await ErrorLoggerService.capture(new Error("Lookup failed"), {
      method: "GET",
      path: "/api/v1/internal/cups/lookup",
      pagePath: "/internal/simulations/new",
      statusCode: 500,
      sendToSentry: false,
    });

    expect(createAppErrorMock).toHaveBeenCalledTimes(2);
    expect(createAppErrorMock.mock.calls[0][0].data.pagePath).toBe(
      "/internal/simulations/new",
    );
    expect(createAppErrorMock.mock.calls[1][0].data).not.toHaveProperty(
      "pagePath",
    );
  });
});
