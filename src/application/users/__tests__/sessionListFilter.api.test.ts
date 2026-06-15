import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/sessions/route";

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
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    userSession: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

describe("session list user filter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it("filters active sessions by user name or email", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/v1/internal/sessions?activeOnly=true&search=bruno",
      ),
    );

    const expectedWhere = {
      isActive: true,
      user: {
        is: {
          OR: [
            {
              fullName: {
                contains: "bruno",
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: "bruno",
                mode: "insensitive",
              },
            },
          ],
        },
      },
    };

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(countMock).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
