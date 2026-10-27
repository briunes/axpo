import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { invalidatePermissionCache } from "@/application/middleware/rbac";
import { recordScope, canAccessRecord } from "@/application/services/recordAccess";
import { GET as listClients } from "../../../../app/api/v1/internal/clients/route";
import { GET as clientOptions } from "../../../../app/api/v1/internal/clients/options/route";
import { GET as getClient, PATCH as editClient, DELETE as deleteClient } from "../../../../app/api/v1/internal/clients/[id]/route";
import { PATCH as savePermissions } from "../../../../app/api/v1/internal/config/role-permissions/route";
import { GET as listSimulations } from "../../../../app/api/v1/internal/simulations/route";
import { listClientsForModule, listSimulationsForModule } from "@/application/module-init/listQueries";
import { SimulationService } from "@/application/services/simulationService";

const authMock = jest.fn();
const permissionMock = jest.fn();
const upsertMock = jest.fn();
const findManyMock = jest.fn();
const countMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const simulationMock = jest.fn();
const simulationListMock = jest.fn();
jest.mock("@/application/middleware/auth", () => ({ requireAuth: (...args: unknown[]) => authMock(...args) }));
jest.mock("@/application/services/errorLoggerService", () => ({ ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) } }));
jest.mock("@/application/services/auditService", () => ({ AuditService: { logEvent: jest.fn() } }));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  rolePermission: { findUnique: (...args: unknown[]) => permissionMock(...args), upsert: (...args: unknown[]) => upsertMock(...args) },
  client: { findMany: (...args: unknown[]) => findManyMock(...args), count: (...args: unknown[]) => countMock(...args), findUnique: (...args: unknown[]) => findUniqueMock(...args), update: (...args: unknown[]) => updateMock(...args) },
  user: { findUnique: async () => ({ id: "own", agencyId: "agency" }) },
  simulation: { findMany: (...args: unknown[]) => simulationListMock(...args), count: async () => 0, findUnique: (...args: unknown[]) => simulationMock(...args) },
} }));

const actor = { userId: "own", agencyId: "agency", role: UserRole.COMMERCIAL };
const client = { id: "client", agencyId: "agency", createdByUserId: "other", isDeleted: false };
const url = "http://localhost/api/v1/internal/clients";

describe("agency record permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidatePermissionCache();
    authMock.mockResolvedValue(actor);
    permissionMock.mockResolvedValue(null);
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    simulationListMock.mockResolvedValue([]);
    findUniqueMock.mockResolvedValue(client);
    simulationMock.mockResolvedValue({ id: "sim", agencyId: "agency", ownerUserId: "other", isDeleted: false });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([UserRole.COMMERCIAL, UserRole.AGENT])("honors enabled/disabled scope for %s without crossing agencies", async role => {
    const user = { ...actor, role };
    for (const allowed of [false, true]) {
      invalidatePermissionCache();
      permissionMock.mockResolvedValue({ allowed });
      expect(await recordScope(user, "clients")).toEqual({ agencyId: "agency", ...(allowed ? {} : { createdByUserId: "own" }) });
      expect(await recordScope(user, "simulations")).toEqual({ agencyId: "agency", ...(allowed ? {} : { ownerUserId: "own" }) });
      expect(await canAccessRecord(user, "clients", client)).toBe(allowed);
      expect(await canAccessRecord(user, "clients", { ...client, createdByUserId: null })).toBe(allowed);
      expect(await canAccessRecord(user, "clients", { ...client, createdByUserId: "own" })).toBe(true);
      expect(await canAccessRecord(user, "clients", { ...client, agencyId: "outside", createdByUserId: "own" })).toBe(false);
      expect(await canAccessRecord(user, "simulations", { agencyId: "outside", ownerUserId: "own" })).toBe(false);
    }
  });

  it("defaults lowest agents to own records, masters to agency, and admins to unrestricted", async () => {
    expect(await recordScope(actor, "clients")).toEqual({ agencyId: "agency", createdByUserId: "own" });
    expect(await recordScope({ ...actor, role: UserRole.AGENT }, "clients")).toEqual({ agencyId: "agency" });
    for (const role of [UserRole.ADMIN, UserRole.SYS_ADMIN]) {
      expect(await recordScope({ ...actor, role }, "clients")).toEqual({});
      expect(await canAccessRecord({ ...actor, role }, "clients", { ...client, agencyId: "outside" })).toBe(true);
    }
  });

  it.each(["", "?minimal=true", "?search=other&agencyId=outside&includeDeleted=true"])("scopes list and total with query %s", async query => {
    expect((await listClients(new NextRequest(url + query))).status).toBe(200);
    const where = findManyMock.mock.calls[0][0].where;
    expect(where).toMatchObject({ agencyId: "agency", createdByUserId: "own", isDeleted: false });
    expect(countMock).toHaveBeenCalledWith({ where });
  });

  it("scopes module initialization and client options too", async () => {
    await listClientsForModule(actor as any, new URLSearchParams("minimal=true&agencyId=outside"));
    expect(findManyMock.mock.calls[0][0].where).toMatchObject({ agencyId: "agency", createdByUserId: "own" });
    findManyMock.mockClear();
    expect((await clientOptions(new NextRequest(url + "/options?agencyId=outside"))).status).toBe(200);
    expect(findManyMock.mock.calls[0][0].where).toMatchObject({ agencyId: "agency", createdByUserId: "own" });
  });

  it.each([getClient, editClient, deleteClient])("denies direct access and writes to another user's client", async handler => {
    // Allow each action independently; ownership must still prevent it.
    permissionMock.mockImplementation(({ where }) => Promise.resolve({ allowed: !where.role_permissionKey.permissionKey.endsWith("view_agency") }));
    expect((await handler(new NextRequest(url + "/client"), { params: { id: "client" } })).status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("allows own detail and agency-shared detail while action denial remains effective", async () => {
    findUniqueMock.mockResolvedValue({ ...client, createdByUserId: "own" });
    expect((await getClient(new NextRequest(url + "/client"), { params: { id: "client" } })).status).toBe(200);
    invalidatePermissionCache();
    findUniqueMock.mockResolvedValue(client);
    permissionMock.mockImplementation(({ where }) => Promise.resolve({ allowed: where.role_permissionKey.permissionKey !== "clients.edit" }));
    expect((await getClient(new NextRequest(url + "/client"), { params: { id: "client" } })).status).toBe(200);
    expect((await editClient(new NextRequest(url + "/client"), { params: { id: "client" } })).status).toBe(403);
  });

  it("uses the same simulation scope for list, detail, selection, archive, and clone", async () => {
    expect(await SimulationService.buildSimulationFilter(actor)).toEqual({ agencyId: "agency", ownerUserId: "own", isDeleted: false });
    await expect(SimulationService.assertSimulationAccess(actor, "sim")).rejects.toThrow("access");
    await expect(SimulationService.updateSelectedOffer(actor, "sim", { selectedOffer: null })).rejects.toThrow("access");
    await expect(SimulationService.softDeleteSimulation(actor, "sim")).rejects.toThrow("access");
    await expect(SimulationService.cloneSimulation(actor, "sim")).rejects.toThrow("access");
    invalidatePermissionCache();
    permissionMock.mockResolvedValue({ allowed: true });
    expect(await SimulationService.buildSimulationFilter(actor)).toEqual({ agencyId: "agency", isDeleted: false });
    await expect(SimulationService.assertSimulationAccess(actor, "sim")).resolves.toMatchObject({ id: "sim" });
    simulationMock.mockResolvedValue({ id: "sim", agencyId: "outside", ownerUserId: "own" });
    await expect(SimulationService.assertSimulationAccess(actor, "sim")).rejects.toThrow("access");
  });

  it("rejects linking another user's client when creating a simulation", async () => {
    await expect(SimulationService.createSimulation(actor, { clientId: "client" })).rejects.toThrow("Access denied");
  });

  it("cannot override simulation ownership using an owner filter in either list endpoint", async () => {
    await listSimulationsForModule(actor as any, new URLSearchParams("ownerUserId=other"));
    expect((await listSimulations(new NextRequest("http://localhost/api/v1/internal/simulations?ownerUserId=other"))).status).toBe(200);
    expect(simulationListMock).toHaveBeenCalledTimes(2);
    for (const [query] of simulationListMock.mock.calls) {
      expect(query.where).toMatchObject({ agencyId: "agency", ownerUserId: "own", AND: [{ ownerUserId: "other" }] });
    }
  });

  it("persists independent permissions and invalidates cached scope when saved", async () => {
    expect(await recordScope(actor, "clients")).toHaveProperty("createdByUserId", "own");
    authMock.mockResolvedValue({ ...actor, role: UserRole.SYS_ADMIN });
    const updates = [
      { role: UserRole.COMMERCIAL, permissionKey: "clients.view_agency", allowed: true },
      { role: UserRole.COMMERCIAL, permissionKey: "simulations.view_agency", allowed: false },
    ];
    const response = await savePermissions(new NextRequest("http://localhost/api/v1/internal/config/role-permissions", { method: "PATCH", body: JSON.stringify({ updates }) }));
    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls.map(call => call[0].create)).toEqual(updates);
    permissionMock.mockImplementation(({ where }) => Promise.resolve({ allowed: where.role_permissionKey.permissionKey === "clients.view_agency" }));
    expect(await recordScope(actor, "clients")).toEqual({ agencyId: "agency" });
    expect(await recordScope(actor, "simulations")).toHaveProperty("ownerUserId", "own");
  });
});
