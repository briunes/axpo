import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulation-issues/export/route";
import { POST } from "../../../../app/api/v1/internal/simulation-issues/import/route";
import { UserRole } from "@/domain/types";
const authMock = jest.fn(); const exportMock = jest.fn(); const importMock = jest.fn();
jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => authMock(...args) }));
jest.mock("@/application/services/errorLoggerService", () => ({ ErrorLoggerService: { capture: async () => undefined } }));
jest.mock("@/application/services/simulationIssueTransferService", () => ({ MAX_ISSUE_TRANSFER_BYTES: 1024, SimulationIssueTransferService: {
  export: (...args: unknown[]) => exportMock(...args), import: (...args: unknown[]) => importMock(...args),
} }));
const url = "http://localhost/api/v1/internal/simulation-issues";
describe("Incident transfer authorization", () => {
  beforeEach(() => { jest.resetAllMocks(); jest.spyOn(console, "error").mockImplementation(() => undefined); exportMock.mockResolvedValue("{}"); importMock.mockResolvedValue({ imported: 1 }); });
  afterEach(() => jest.restoreAllMocks());
  it.each([UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL])("denies both actions to %s", async (role) => {
    authMock.mockResolvedValue({ userId: "user", role });
    expect((await GET(new NextRequest(`${url}/export`))).status).toBe(403);
    expect((await POST(new NextRequest(`${url}/import`, { method: "POST", body: "{}" }))).status).toBe(403);
    expect(exportMock).not.toHaveBeenCalled(); expect(importMock).not.toHaveBeenCalled();
  });
  it("exports only explicitly selected IDs for sys admins without caching", async () => {
    authMock.mockResolvedValue({ userId: "sys", role: UserRole.SYS_ADMIN });
    const response = await GET(new NextRequest(`${url}/export?id=issue-1&id=issue-2&id=issue-1`));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(exportMock).toHaveBeenCalledWith({ id: { in: ["issue-1", "issue-2"] } });
  });
  it("rejects an empty selection instead of exporting all incidents", async () => {
    authMock.mockResolvedValue({ userId: "sys", role: UserRole.SYS_ADMIN });
    expect((await GET(new NextRequest(`${url}/export`))).status).toBe(400);
    expect(exportMock).not.toHaveBeenCalled();
  });
  it("previews and imports only for sys admins", async () => {
    authMock.mockResolvedValue({ userId: "sys", role: UserRole.SYS_ADMIN });
    expect((await POST(new NextRequest(`${url}/import?preview=true`, { method: "POST", body: "{}" }))).status).toBe(200);
    expect(importMock).toHaveBeenLastCalledWith({}, "sys", true);
    await POST(new NextRequest(`${url}/import`, { method: "POST", body: "{}" }));
    expect(importMock).toHaveBeenLastCalledWith({}, "sys", false);
  });
  it("rejects invalid JSON and oversized uploads before processing", async () => {
    authMock.mockResolvedValue({ userId: "sys", role: UserRole.SYS_ADMIN });
    expect((await POST(new NextRequest(`${url}/import`, { method: "POST", body: "not-json" }))).status).toBe(400);
    expect((await POST(new NextRequest(`${url}/import`, { method: "POST", body: "x".repeat(1025) }))).status).toBe(400);
    expect(importMock).not.toHaveBeenCalled();
  });
});
