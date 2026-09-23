import { assertPermission } from "../rbac";
import { AuthContext } from "../auth";
import { UserRole } from "@/domain/types";
const configMock = jest.fn();
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  systemConfig: { findFirst: (...args: unknown[]) => configMock(...args) },
} }));
const context = (role: UserRole, userId = "assigned") => ({ role, userId } as AuthContext);
describe("Incident management assignment", () => {
  beforeEach(() => configMock.mockResolvedValue({ simulationIssuesEnabled: true, incidentRecipientIds: ["assigned"] }));
  it.each([UserRole.ADMIN, UserRole.SYS_ADMIN])("requires assignment even for %s", async role => {
    await expect(assertPermission(context(role), "section.simulation-issues")).resolves.toBeUndefined();
    await expect(assertPermission(context(role, "other"), "section.simulation-issues")).rejects.toThrow("not assigned");
  });
  it("denies ordinary users even if their ID is in the configuration", async () => {
    await expect(assertPermission(context(UserRole.AGENT), "section.simulation-issues")).rejects.toThrow("not assigned");
  });
  it.each([null, { incidentRecipientIds: [] }, { simulationIssuesEnabled: false, incidentRecipientIds: ["assigned"] }])("fails closed for unavailable, empty or disabled settings", async config => {
    configMock.mockResolvedValue(config);
    await expect(assertPermission(context(UserRole.SYS_ADMIN), "section.simulation-issues")).rejects.toThrow("not assigned");
  });
});
