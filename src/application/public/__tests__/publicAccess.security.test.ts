import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/public/simulations/access/route";
import { RateLimitError } from "@/domain/errors/errors";

const applyRateLimitMock = jest.fn();
const getClientRateLimitKeyMock = jest.fn();

const findSimulationMock = jest.fn();
const findVersionMock = jest.fn();
const accessAttemptCreateMock = jest.fn();
const auditLogEventMock = jest.fn();

jest.mock("@/application/middleware/rateLimit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
  getClientRateLimitKey: (...args: unknown[]) => getClientRateLimitKeyMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findFirst: (...args: unknown[]) => findSimulationMock(...args),
    },
    simulationVersion: {
      findFirst: (...args: unknown[]) => findVersionMock(...args),
    },
    accessAttempt: {
      create: (...args: unknown[]) => accessAttemptCreateMock(...args),
    },
  },
}));

jest.mock("@/application/services/auditService", () => ({
  AuditService: {
    logEvent: (...args: unknown[]) => auditLogEventMock(...args),
  },
}));

describe("public access POST security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    getClientRateLimitKeyMock.mockReturnValue("public:test");
    applyRateLimitMock.mockReturnValue(undefined);
    auditLogEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    applyRateLimitMock.mockImplementation(() => {
      throw new RateLimitError(60);
    });

    const request = new NextRequest("http://localhost/api/v1/public/simulations/access", {
      method: "POST",
      body: JSON.stringify({
        token: "1234567890abcdef",
        pin: "1234",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(findSimulationMock).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    findSimulationMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/public/simulations/access", {
      method: "POST",
      body: JSON.stringify({
        token: "1234567890abcdef",
        pin: "1234",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_TOKEN");
    expect(auditLogEventMock).toHaveBeenCalledTimes(1);
  });
});
