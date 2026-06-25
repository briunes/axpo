import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/base-values/route";
import { BaseValueScope, UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const agencyFindUniqueMock = jest.fn();
const baseValueFindManyMock = jest.fn();
const baseValueCountMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
  assertRole: jest.fn(),
  isElevatedRole: (role: UserRole) =>
    role === UserRole.ADMIN || role === UserRole.SYS_ADMIN,
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: {
      findUnique: (...args: unknown[]) => agencyFindUniqueMock(...args),
    },
    baseValueSet: {
      findMany: (...args: unknown[]) => baseValueFindManyMock(...args),
      count: (...args: unknown[]) => baseValueCountMock(...args),
    },
  },
}));

jest.mock("@/application/services/auditService", () => ({
  AuditService: { logEvent: jest.fn() },
}));

describe("base value agency scope listing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      userId: "sys-admin-1",
      role: UserRole.SYS_ADMIN,
      agencyId: "admin-agency",
      email: "sysadmin@example.com",
    });
    assertPermissionMock.mockResolvedValue(undefined);
    baseValueFindManyMock.mockResolvedValue([]);
    baseValueCountMock.mockResolvedValue(0);
  });

  it("excludes TLV base values when sys admin lists values for a non-TLV agency", async () => {
    agencyFindUniqueMock.mockResolvedValue({ isTlv: false });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/v1/internal/base-values?forAgencyId=agency-1",
        { headers: { authorization: "Bearer token" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(agencyFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "agency-1" },
      select: { isTlv: true },
    });
    expect(baseValueFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          OR: [
            { scopeType: BaseValueScope.GLOBAL },
            { agencyId: "agency-1" },
          ],
        }),
      }),
    );
    expect(baseValueFindManyMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.objectContaining({ scopeType: BaseValueScope.TLV }),
      }),
    );
  });

  it("lists only TLV base values when sys admin lists values for a TLV agency", async () => {
    agencyFindUniqueMock.mockResolvedValue({ isTlv: true });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/v1/internal/base-values?forAgencyId=agency-tlv",
        { headers: { authorization: "Bearer token" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(baseValueFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          scopeType: BaseValueScope.TLV,
        }),
      }),
    );
  });
});
