import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/access-requests/route";
import { POST as APPROVE } from "../../../../app/api/v1/internal/access-requests/[id]/approve/route";
import { POST as REJECT } from "../../../../app/api/v1/internal/access-requests/[id]/reject/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const findManyMock = jest.fn();
const countMock = jest.fn();
const findFirstMock = jest.fn();
const updateMock = jest.fn();
const createUserMock = jest.fn();
const auditMock = jest.fn();
const resolveAccessRequestMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => requireAuthMock(...args) }));
jest.mock("@/application/middleware/rbac", () => ({ assertPermission: (...args: unknown[]) => assertPermissionMock(...args) }));
jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: { accessRequest: {
    findMany: (...args: unknown[]) => findManyMock(...args),
    count: (...args: unknown[]) => countMock(...args),
    findFirst: (...args: unknown[]) => findFirstMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  } },
}));
jest.mock("@/application/services/authService", () => ({ AuthService: { createUser: (...args: unknown[]) => createUserMock(...args) } }));
jest.mock("@/application/services/auditService", () => ({ AuditService: { logEvent: (...args: unknown[]) => auditMock(...args) } }));
jest.mock("@/application/services/notificationService", () => ({
  NotificationService: { resolveAccessRequest: (...args: unknown[]) => resolveAccessRequestMock(...args) },
}));

const auth = { userId: "admin-1", role: UserRole.ADMIN, agencyId: "agency-1", email: "admin@example.com" };
const pending = {
  id: "request-1", status: "PENDING", agencyId: "agency-1", fullName: "Applicant",
  email: "applicant@example.com", phone: "+34912345678", comments: "Details",
};

describe("access request management API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue(auth);
    assertPermissionMock.mockResolvedValue(undefined);
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    findFirstMock.mockResolvedValue(pending);
    updateMock.mockResolvedValue(undefined);
    createUserMock.mockResolvedValue({ user: { id: "user-1", email: pending.email } });
    auditMock.mockResolvedValue(undefined);
    resolveAccessRequestMock.mockResolvedValue(undefined);
  });

  it("scopes an admin list to their agency", async () => {
    const response = await GET(new NextRequest("http://localhost/api/v1/internal/access-requests"));
    expect(response.status).toBe(200);
    expect(findManyMock.mock.calls[0][0].where).toEqual(expect.objectContaining({ agencyId: "agency-1" }));
  });

  it("approves by creating a commercial user from request contact details", async () => {
    const response = await (APPROVE as any)(
      new NextRequest("http://localhost/api/v1/internal/access-requests/request-1/approve", { method: "POST" }),
      { params: { id: "request-1" } },
    );
    expect(response.status).toBe(201);
    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({
      agencyId: "agency-1", role: UserRole.COMMERCIAL,
      mobilePhone: pending.phone, commercialPhone: pending.phone,
      email: pending.email, commercialEmail: pending.email,
    }));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }));
    expect(resolveAccessRequestMock).toHaveBeenCalledWith("request-1");
  });

  it("rejects without creating a user", async () => {
    const response = await (REJECT as any)(
      new NextRequest("http://localhost/api/v1/internal/access-requests/request-1/reject", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
      { params: { id: "request-1" } },
    );
    expect(response.status).toBe(200);
    expect(createUserMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }));
    expect(resolveAccessRequestMock).toHaveBeenCalledWith("request-1");
  });
});
