import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/cups/lookup/route";

const findSimulationsMock = jest.fn();
const findVersionsMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({
    userId: "user-1",
    role: "ADMIN",
    agencyId: "agency-1",
  }),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/application/services/simulationService", () => ({
  SimulationService: {
    buildSimulationFilter: jest.fn().mockReturnValue({ agencyId: "agency-1" }),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findMany: (...args: unknown[]) => findSimulationsMock(...args),
    },
    simulationVersion: {
      findMany: (...args: unknown[]) => findVersionsMock(...args),
    },
  },
}));

describe("CUPS lookup in Supabase API compatible mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("joins versions to simulations without relying on embedded relations", async () => {
    findSimulationsMock.mockResolvedValue([
      {
        id: "simulation-1",
        clientId: "client-1",
        updatedAt: new Date("2026-06-09T10:00:00.000Z"),
        status: "DRAFT",
      },
    ]);
    findVersionsMock.mockResolvedValue([
      {
        simulationId: "simulation-1",
        payloadJson: {
          electricity: {
            clientData: {
              cups: " es001 ",
              nombreTitular: "Example",
            },
          },
        },
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/v1/internal/cups/lookup?clientId=client-1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findVersionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { simulationId: { in: ["simulation-1"] } },
        select: { payloadJson: true, simulationId: true },
      }),
    );
    expect(body.data.items).toEqual([
      expect.objectContaining({
        cups: "ES001",
        clientId: "client-1",
        lastStatus: "DRAFT",
      }),
    ]);
  });

  it("does not query versions when no authorized simulations exist", async () => {
    findSimulationsMock.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/v1/internal/cups/lookup"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(findVersionsMock).not.toHaveBeenCalled();
  });
});
