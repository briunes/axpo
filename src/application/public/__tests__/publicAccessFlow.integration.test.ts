import { NextRequest } from "next/server";
import { POST as accessPOST } from "../../../../app/api/v1/public/simulations/access/route";
import { GET as publicGET } from "../../../../app/api/v1/public/simulations/[token]/route";

const applyRateLimitMock = jest.fn();
const getClientRateLimitKeyMock = jest.fn();
const verifyPinMock = jest.fn();

const findSimulationMock = jest.fn();
const findManyVersionMock = jest.fn();
const accessAttemptCreateMock = jest.fn();
const auditLogEventMock = jest.fn();

jest.mock("@/application/middleware/rateLimit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
  getClientRateLimitKey: (...args: unknown[]) =>
    getClientRateLimitKeyMock(...args),
}));

jest.mock("@/application/services/pinService", () => ({
  PinService: {
    verify: (...args: unknown[]) => verifyPinMock(...args),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findFirst: (...args: unknown[]) => findSimulationMock(...args),
    },
    simulationVersion: {
      findMany: (...args: unknown[]) => findManyVersionMock(...args),
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

describe("public access flow integration", () => {
  let consoleErrorSpy: jest.SpyInstance;
  const now = new Date("2026-03-12T10:00:00.000Z");
  const farFuture = new Date("2099-01-01T00:00:00.000Z");
  const expired = new Date("2026-03-01T00:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    getClientRateLimitKeyMock.mockReturnValue("public:tok-abc");
    applyRateLimitMock.mockReturnValue(undefined);
    verifyPinMock.mockResolvedValue(true);
    accessAttemptCreateMock.mockResolvedValue(undefined);
    auditLogEventMock.mockResolvedValue(undefined);
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("grants access session and then returns simulation details", async () => {
    findSimulationMock
      .mockResolvedValueOnce({
        id: "sim-1",
        status: "SHARED",
        expiresAt: farFuture,
        sharedAt: now,
        publicToken: "tok-abc",
        pinHashSnapshot: "hashed-pin",
        ownerUser: {
          id: "owner-1",
          fullName: "Owner",
          email: "owner@example.com",
        },
      })
      .mockResolvedValueOnce({
        id: "sim-1",
        status: "SHARED",
        expiresAt: farFuture,
        sharedAt: now,
        publicToken: "tok-abc",
        ownerUser: {
          id: "owner-1",
          fullName: "Owner",
          email: "owner@example.com",
        },
      });

    findManyVersionMock
      .mockResolvedValueOnce([
        { id: "ver-1", payloadJson: { amount: 123 }, createdAt: now },
      ])
      .mockResolvedValueOnce([
        { id: "ver-1", payloadJson: { amount: 123 }, createdAt: now },
      ]);

    const accessRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/access",
      {
        method: "POST",
        body: JSON.stringify({ token: "tok-abc-1234567890", pin: "1234" }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.0.1",
        },
      },
    );

    const accessResponse = await accessPOST(accessRequest);
    const accessBody = await accessResponse.json();

    expect(accessResponse.status).toBe(200);
    expect(accessBody.success).toBe(true);
    expect(typeof accessBody.data.accessSessionToken).toBe("string");

    const readRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-abc-1234567890",
      {
        headers: {
          authorization: `Bearer ${accessBody.data.accessSessionToken as string}`,
        },
      },
    );

    const readResponse = await publicGET(readRequest, {
      params: { token: "tok-abc-1234567890" },
    });
    const readBody = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readBody.success).toBe(true);
    expect(readBody.data.simulation.id).toBe("sim-1");
    expect(readBody.data.latestVersion.id).toBe("ver-1");
    expect(accessAttemptCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          simulationId: "sim-1",
          success: true,
          reason: "SUCCESS",
        }),
      }),
    );
  });

  it("denies retrieval when session token is used on a different public token", async () => {
    findSimulationMock.mockResolvedValueOnce({
      id: "sim-1",
      status: "SHARED",
      expiresAt: farFuture,
      sharedAt: now,
      publicToken: "tok-abc-1234567890",
      pinHashSnapshot: "hashed-pin",
      ownerUser: {
        id: "owner-1",
        fullName: "Owner",
        email: "owner@example.com",
      },
    });
    findManyVersionMock.mockResolvedValueOnce([
      { id: "ver-1", payloadJson: { amount: 123 }, createdAt: now },
    ]);

    const accessRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/access",
      {
        method: "POST",
        body: JSON.stringify({ token: "tok-abc-1234567890", pin: "1234" }),
        headers: { "content-type": "application/json" },
      },
    );

    const accessResponse = await accessPOST(accessRequest);
    const accessBody = await accessResponse.json();

    const readRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-other-1234567890",
      {
        headers: {
          authorization: `Bearer ${accessBody.data.accessSessionToken as string}`,
        },
      },
    );

    const readResponse = await publicGET(readRequest, {
      params: { token: "tok-other-1234567890" },
    });
    const readBody = await readResponse.json();

    expect(readResponse.status).toBe(401);
    expect(readBody.success).toBe(false);
    expect(readBody.error.code).toBe("INVALID_TOKEN");
    expect(findSimulationMock).toHaveBeenCalledTimes(1);
  });

  it("denies retrieval when simulation expires between access and read", async () => {
    findSimulationMock
      .mockResolvedValueOnce({
        id: "sim-1",
        status: "SHARED",
        expiresAt: farFuture,
        sharedAt: now,
        publicToken: "tok-abc-1234567890",
        pinHashSnapshot: "hashed-pin",
        ownerUser: {
          id: "owner-1",
          fullName: "Owner",
          email: "owner@example.com",
        },
      })
      .mockResolvedValueOnce({
        id: "sim-1",
        status: "EXPIRED",
        expiresAt: expired,
        sharedAt: now,
        publicToken: "tok-abc-1234567890",
        ownerUser: {
          id: "owner-1",
          fullName: "Owner",
          email: "owner@example.com",
        },
      });
    findManyVersionMock.mockResolvedValue([
      { id: "ver-1", payloadJson: { amount: 123 }, createdAt: now },
    ]);

    const accessRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/access",
      {
        method: "POST",
        body: JSON.stringify({ token: "tok-abc-1234567890", pin: "1234" }),
        headers: { "content-type": "application/json" },
      },
    );

    const accessResponse = await accessPOST(accessRequest);
    const accessBody = await accessResponse.json();

    const readRequest = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-abc-1234567890",
      {
        headers: {
          authorization: `Bearer ${accessBody.data.accessSessionToken as string}`,
        },
      },
    );

    const readResponse = await publicGET(readRequest, {
      params: { token: "tok-abc-1234567890" },
    });
    const readBody = await readResponse.json();

    expect(readResponse.status).toBe(401);
    expect(readBody.success).toBe(false);
    expect(readBody.error.code).toBe("INVALID_TOKEN");
  });
});
