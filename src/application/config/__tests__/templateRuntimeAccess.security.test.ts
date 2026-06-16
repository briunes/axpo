import { NextRequest } from "next/server";
import { GET as getPdfTemplates } from "../../../../app/api/v1/internal/config/pdf-templates/route";
import { GET as getEmailTemplates } from "../../../../app/api/v1/internal/config/email-templates/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const pdfFindManyMock = jest.fn();
const emailFindManyMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    pdfTemplate: {
      findMany: (...args: unknown[]) => pdfFindManyMock(...args),
      create: jest.fn(),
    },
    emailTemplate: {
      findMany: (...args: unknown[]) => emailFindManyMock(...args),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) },
}));

describe("runtime template access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    assertPermissionMock.mockResolvedValue(undefined);
    pdfFindManyMock.mockResolvedValue([]);
    emailFindManyMock.mockResolvedValue([]);
  });

  it("uses simulation access for active price-history templates", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/internal/config/pdf-templates?active=true&type=price-history",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await getPdfTemplates(request);

    expect(response.status).toBe(200);
    expect(assertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.AGENT }),
      "section.simulations",
    );
    expect(pdfFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, type: "price-history" },
      }),
    );
  });

  it("uses share access for active simulation and email templates", async () => {
    const pdfRequest = new NextRequest(
      "http://localhost/api/v1/internal/config/pdf-templates?active=true&excludeType=price-history",
      { headers: { authorization: "Bearer token" } },
    );
    const emailRequest = new NextRequest(
      "http://localhost/api/v1/internal/config/email-templates?active=true&excludeType=price-history",
      { headers: { authorization: "Bearer token" } },
    );

    expect((await getPdfTemplates(pdfRequest)).status).toBe(200);
    expect((await getEmailTemplates(emailRequest)).status).toBe(200);
    expect(assertPermissionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: UserRole.AGENT }),
      "simulations.share",
    );
    expect(assertPermissionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: UserRole.AGENT }),
      "simulations.share",
    );
  });

  it("keeps unrestricted template lists configuration-only", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/internal/config/pdf-templates",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await getPdfTemplates(request);

    expect(response.status).toBe(200);
    expect(assertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.AGENT }),
      "section.configurations",
    );
  });
});
