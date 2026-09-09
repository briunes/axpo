import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/agencies/route";
import { listAgenciesForModule } from "@/application/module-init/listQueries";
import { UserRole } from "@/domain/types";

const auth = { userId: "admin-1", sessionId: "session-1", role: UserRole.ADMIN, agencyId: "agency-1", email: "admin@example.com" };
const findManyMock = jest.fn();
const countMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: jest.fn(() => Promise.resolve(auth)),
}));
jest.mock("@/application/services/simulationService", () => ({ SimulationService: {} }));
jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

const agencies = Array.from({ length: 115 }, (_, i) => ({ id: `agency-${i}`, name: `Agency ${i}` }));

describe.each(["endpoint", "module-init"])("agency pagination: %s", (path) => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock.mockImplementation(({ skip, take }) => Promise.resolve(agencies.slice(skip, skip + take)));
    countMock.mockResolvedValue(agencies.length);
  });

  async function load(query: string) {
    if (path === "module-init") return listAgenciesForModule(auth, new URLSearchParams(query));
    const response = await GET(new NextRequest(`http://localhost/api/v1/internal/agencies?${query}`));
    expect(response.status).toBe(200);
    return (await response.json()).data;
  }

  it("returns all 115 agency options when the Users page requests 1000", async () => {
    const result = await load("minimal=true&pageSize=1000");
    expect(result.items).toEqual(agencies);
    expect(result).toMatchObject({ total: 115, page: 1, pageSize: 1000 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ id: true, name: true }) }));
  });

  it("caps minimal requests at 1000", async () => {
    expect((await load("minimal=true&pageSize=5000")).pageSize).toBe(1000);
  });

  it("preserves the 100-record cap and page offsets for full agency tables", async () => {
    const result = await load("pageSize=1000&page=2");
    expect(result.items).toEqual(agencies.slice(100));
    expect(result.pageSize).toBe(100);
  });

  it("preserves the default page size for minimal requests", async () => {
    const result = await load("minimal=true");
    expect(result.items).toHaveLength(25);
    expect(result.pageSize).toBe(25);
  });
});
