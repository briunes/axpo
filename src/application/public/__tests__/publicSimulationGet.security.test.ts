import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { GET } from "../../../../app/api/v1/public/simulations/[token]/route";

const findSimulationMock = jest.fn();
const findManyVersionMock = jest.fn();

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findFirst: (...args: unknown[]) => findSimulationMock(...args),
    },
    simulationVersion: {
      findMany: (...args: unknown[]) => findManyVersionMock(...args),
    },
  },
}));

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    verify: jest.fn(),
  },
}));

describe("public simulation GET security", () => {
  const now = new Date("2026-03-11T10:00:00.000Z");
  const farFuture = new Date("2099-01-01T00:00:00.000Z");
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns simulation details when public session is valid", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      typ: "PUBLIC_SIM_ACCESS",
      sid: "sim-1",
      tok: "tok-abc",
    });

    findSimulationMock.mockResolvedValue({
      id: "sim-1",
      status: "SHARED",
      expiresAt: farFuture,
      sharedAt: now,
      ownerUser: {
        id: "owner-1",
        fullName: "Owner",
        email: "owner@example.com",
      },
    });

    findManyVersionMock.mockResolvedValue([
      {
        id: "ver-1",
        payloadJson: { value: 123 },
        createdAt: now,
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-abc",
      {
        headers: {
          authorization: "Bearer session-1",
        },
      },
    );

    const response = await GET(request, { params: { token: "tok-abc" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.simulation.id).toBe("sim-1");
    expect(body.data.latestVersion.id).toBe("ver-1");
  });

  it("rejects when session token payload does not match route token", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      typ: "PUBLIC_SIM_ACCESS",
      sid: "sim-1",
      tok: "different-token",
    });

    const request = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-abc",
      {
        headers: {
          authorization: "Bearer session-1",
        },
      },
    );

    const response = await GET(request, { params: { token: "tok-abc" } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_TOKEN");
    expect(findSimulationMock).not.toHaveBeenCalled();
  });

  it("rejects when public session token is missing", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/public/simulations/tok-abc",
    );

    const response = await GET(request, { params: { token: "tok-abc" } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_TOKEN");
    expect(findSimulationMock).not.toHaveBeenCalled();
    expect(findManyVersionMock).not.toHaveBeenCalled();
  });
});
