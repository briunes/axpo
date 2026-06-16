import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/clients/route";

const findManyMock = jest.fn();
const countMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({
    userId: "admin-1",
    role: "ADMIN",
    agencyId: "agency-1",
  }),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: jest.fn().mockResolvedValue(undefined),
  isElevatedRole: jest.fn().mockReturnValue(true),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    client: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

describe("minimal client list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it("includes the fields needed for OCR matching and client options", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/v1/internal/clients?minimal=true&pageSize=100",
      ),
    );

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          name: true,
          cif: true,
          contactName: true,
          contactEmail: true,
        }),
      }),
    );
  });
});
