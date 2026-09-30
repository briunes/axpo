import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulations/[id]/route";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { resolveDefaultBaseValueSetId } from "@/application/services/simulationCalculationRunner";
import { getBaseValueBillingMonths } from "@/application/services/baseValueBillingMonths";

jest.mock("@/application/middleware/auth", () => ({ requireAuth: jest.fn().mockResolvedValue({ userId: "user" }) }));
jest.mock("@/application/middleware/rbac", () => ({ assertPermission: jest.fn() }));
jest.mock("@/application/middleware/errorHandler", () => ({ withErrorHandler: (handler: unknown) => handler }));
jest.mock("@/application/lib/sensitiveData", () => ({ tryDecryptSensitiveValue: (value: unknown) => value }));
jest.mock("@/application/services/simulationService", () => ({ SimulationService: { assertSimulationAccess: jest.fn() } }));
// The load endpoint may resolve a default set, but must never run calculations.
jest.mock("@/application/services/simulationCalculationRunner", () => ({ resolveDefaultBaseValueSetId: jest.fn() }));
jest.mock("@/application/services/baseValueBillingMonths", () => ({ getBaseValueBillingMonths: jest.fn() }));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  simulationVersion: { findMany: jest.fn() },
  client: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  agency: { findUnique: jest.fn() },
} }));

const load = () => GET(new NextRequest("http://localhost/api/v1/internal/simulations/sim"), { params: { id: "sim" } });
const payload = { type: "ELECTRICITY", electricity: { tarifaAcceso: "3.0TD", perfilCarga: "NORMAL", zonaGeografica: "Peninsula" }, results: { total: 123.456, baseValueSetId: "saved" }, selectedOffer: { productKey: "PERSONALIZADA_INDEX" } };
const version = { id: "version", payloadJson: payload, baseValueSetId: "saved", createdBy: "user", createdAt: new Date("2026-09-01") };

beforeEach(() => {
  jest.resetAllMocks();
  (SimulationService.assertSimulationAccess as jest.Mock).mockResolvedValue({ id: "sim", clientId: "client", ownerUserId: "owner", agencyId: "agency", agency: { isTlv: false }, pinSnapshot: "1234", pinHashSnapshot: "secret" });
  (prisma.simulationVersion.findMany as jest.Mock).mockResolvedValue([version]);
  (prisma.client.findUnique as jest.Mock).mockResolvedValue({ id: "client" });
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "owner" });
  (prisma.agency.findUnique as jest.Mock).mockResolvedValue({ id: "agency", isTlv: false });
  (getBaseValueBillingMonths as jest.Mock).mockResolvedValue(["2026-08"]);
  (resolveDefaultBaseValueSetId as jest.Mock).mockResolvedValue("default");
});

it("starts independent reads while the saved version is still pending", async () => {
  let release!: (value: unknown) => void;
  (prisma.simulationVersion.findMany as jest.Mock).mockReturnValue(new Promise(resolve => { release = resolve; }));
  const pending = load();
  await new Promise(resolve => setImmediate(resolve));
  const independentReadsStarted = [prisma.client.findUnique, prisma.user.findUnique, prisma.agency.findUnique].every(fn => (fn as jest.Mock).mock.calls.length === 1);
  release([version]);
  await pending;
  expect(independentReadsStarted).toBe(true);
});

it("returns saved results and version summaries without changing their values", async () => {
  const body = await (await load()).json();
  expect(body.data.simulation.payloadJson).toEqual(payload);
  expect(body.data.simulation).toMatchObject({ baseValueSetId: "saved", billingMonths: ["2026-08"], client: { id: "client" }, ownerUser: { id: "owner" }, agency: { id: "agency" }, pinSnapshot: "1234" });
  expect(body.data.simulation).not.toHaveProperty("pinHashSnapshot");
  expect(body.data.versions[0]).not.toHaveProperty("payloadJson");
  expect(resolveDefaultBaseValueSetId).not.toHaveBeenCalled();
  expect(getBaseValueBillingMonths).toHaveBeenCalledWith("saved");
});

it.each([false, true])("preserves the default-set lookup for isTlv=%s", async isTlv => {
  (SimulationService.assertSimulationAccess as jest.Mock).mockResolvedValue({ id: "sim", ownerUserId: "owner", agencyId: "agency", agency: { isTlv } });
  (prisma.simulationVersion.findMany as jest.Mock).mockResolvedValue([{ ...version, baseValueSetId: null }]);
  const body = await (await load()).json();
  expect(resolveDefaultBaseValueSetId).toHaveBeenCalledWith(isTlv);
  expect(getBaseValueBillingMonths).toHaveBeenCalledWith("default");
  expect(body.data.simulation.baseValueSetId).toBeNull();
  expect(body.data.simulation.payloadJson).toEqual(payload);
  expect(prisma.client.findUnique).not.toHaveBeenCalled();
});

it("returns empty months when no saved or default set exists", async () => {
  (prisma.simulationVersion.findMany as jest.Mock).mockResolvedValue([]);
  (resolveDefaultBaseValueSetId as jest.Mock).mockResolvedValue(null);
  const body = await (await load()).json();
  expect(body.data.simulation).toMatchObject({ payloadJson: null, baseValueSetId: null, billingMonths: [] });
  expect(getBaseValueBillingMonths).not.toHaveBeenCalled();
});

it("does not launch detail reads before access is granted", async () => {
  (SimulationService.assertSimulationAccess as jest.Mock).mockRejectedValue(new Error("denied"));
  await expect(load()).rejects.toThrow("denied");
  for (const fn of [prisma.simulationVersion.findMany, prisma.client.findUnique, prisma.user.findUnique, prisma.agency.findUnique, getBaseValueBillingMonths]) expect(fn).not.toHaveBeenCalled();
});
