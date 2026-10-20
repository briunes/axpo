import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/cups/lookup/route";

const findSimulationsMock = jest.fn();
const findVersionsMock = jest.fn();
const queryRawMock = jest.fn();
const apiModeMock = jest.fn();
jest.mock("@/infrastructure/database/databaseMode", () => ({ isSupabaseApiMode: () => apiModeMock() }));

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
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    simulation: {
      findMany: (...args: unknown[]) => findSimulationsMock(...args),
    },
    simulationVersion: {
      findMany: (...args: unknown[]) => findVersionsMock(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  apiModeMock.mockReturnValue(true);
});

describe("CUPS lookup in Supabase API compatible mode", () => {

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

it("projects client data in direct mode, preserves older distinct CUPS and newest duplicates", async () => {
  apiModeMock.mockReturnValue(false);
  findSimulationsMock.mockResolvedValue([{ id: "authorized", clientId: "client-1", status: "DRAFT", updatedAt: new Date("2026-09-01") }]);
  const row = (cups: string, name: string, simulationId = "authorized") => ({ simulationId, payloadJson: { electricity: { clientData: { cups, nombreTitular: name } } } });
  queryRawMock.mockResolvedValue([row(" es001 ", "Newest"), row("ES001", "Older"), row("ES002", "Historic"), row("ES003", "Hidden", "unauthorized"), { simulationId: "authorized", payloadJson: { electricity: { clientData: null } } }]);
  const response = await GET(new NextRequest("http://localhost/api/v1/internal/cups/lookup?clientId=client-1"));
  const body = await response.json();
  expect(body.data.items.map((item: any) => [item.cups, item.nombreTitular])).toEqual([["ES001", "Newest"], ["ES002", "Historic"]]);
  expect(findVersionsMock).not.toHaveBeenCalled();
  const query = queryRawMock.mock.calls[0][0];
  expect(query.values).toEqual(["authorized"]);
  expect(query.sql).toContain('"payloadJson" #>');
  expect(query.sql).toContain('ORDER BY "createdAt" DESC');
  expect(findSimulationsMock).toHaveBeenCalledWith(expect.objectContaining({ where: { agencyId: "agency-1", isDeleted: false, clientId: "client-1" } }));
});

it("skips the direct version query when no authorized simulations exist", async () => {
  apiModeMock.mockReturnValue(false);
  queryRawMock.mockClear();
  findSimulationsMock.mockResolvedValue([]);
  const response = await GET(new NextRequest("http://localhost/api/v1/internal/cups/lookup"));
  expect((await response.json()).data.items).toEqual([]);
  expect(queryRawMock).not.toHaveBeenCalled();
});
