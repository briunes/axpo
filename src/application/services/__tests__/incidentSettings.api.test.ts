import { NextRequest } from "next/server";
import { GET, PUT } from "../../../../app/api/v1/internal/config/system/route";
const authMock = jest.fn();
const permissionMock = jest.fn();
const configMock = jest.fn();
const usersMock = jest.fn();
const updateMock = jest.fn();
jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => authMock(...args) }));
jest.mock("@/application/middleware/rbac", () => ({ assertPermission: (...args: unknown[]) => permissionMock(...args) }));
jest.mock("@/application/services/errorLoggerService", () => ({ ErrorLoggerService: { capture: async () => undefined } }));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  systemConfig: { findFirst: (...args: unknown[]) => configMock(...args), update: (...args: unknown[]) => updateMock(...args) },
  user: { findMany: (...args: unknown[]) => usersMock(...args) },
} }));
const config = { id: "config", incidentRecipientIds: ["admin"], simulationIssuesEnabled: true };
const request = (data: unknown) => new NextRequest("http://localhost/api/v1/internal/config/system", { method: "PUT", body: JSON.stringify(data) });
describe("Incident configuration API", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authMock.mockResolvedValue({ userId: "admin", role: "ADMIN" });
    configMock.mockResolvedValue(config);
    usersMock.mockResolvedValue([{ id: "admin" }]);
    updateMock.mockResolvedValue(config);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it.each(["admin", "unselected"])("exposes only current user's access in runtime config: %s", async userId => {
    authMock.mockResolvedValue({ userId, role: "ADMIN" });
    const response = await GET(new NextRequest("http://localhost/api/v1/internal/config/system?view=runtime"));
    const body = await response.json();
    expect(body.canManageSimulationIssues).toBe(userId === "admin");
    expect(body.incidentRecipientIds).toBeUndefined();
  });
  it("lists only active eligible users for configuration", async () => {
    const response = await GET(new NextRequest("http://localhost/api/v1/internal/config/system?view=admin"));
    expect(response.status).toBe(200);
    expect(permissionMock).toHaveBeenCalledWith(expect.anything(), "section.configurations");
    expect(usersMock).toHaveBeenCalledWith(expect.objectContaining({ where: {
      role: { in: ["ADMIN", "SYS_ADMIN"] }, isActive: true, isDeleted: false, deletedAt: null,
    } }));
  });
  it.each([null, "admin", [4], [""], ["admin", "ineligible"]])("rejects invalid recipient selections: %j", async selection => {
    expect((await PUT(request({ incidentRecipientIds: selection }))).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("saves deduplicated recipients", async () => {
    expect((await PUT(request({ incidentRecipientIds: ["admin", "admin"] }))).status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "config" }, data: { incidentRecipientIds: ["admin"] } });
  });
  it("allows removing all recipients", async () => {
    usersMock.mockResolvedValue([]);
    expect((await PUT(request({ incidentRecipientIds: [] }))).status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "config" }, data: { incidentRecipientIds: [] } });
  });
});
