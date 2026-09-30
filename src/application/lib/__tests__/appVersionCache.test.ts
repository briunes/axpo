import { prisma } from "@/infrastructure/database/prisma";
import { warmAppVersionCache, invalidateAppVersionCache, getLoadedAppVersion } from "../appVersionCache";

jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { systemConfig: { findFirst: jest.fn() } } }));
const originalEnv = process.env.NODE_ENV;
beforeEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  jest.resetAllMocks();
  invalidateAppVersionCache();
});
afterEach(() => { (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv; invalidateAppVersionCache(); });

function deferred() {
  let resolve!: (value: { appVersion: string }) => void;
  const promise = new Promise<{ appVersion: string }>(done => { resolve = done; });
  return { promise, resolve };
}

it("shares one pending version query across simultaneous requests", async () => {
  const query = deferred();
  (prisma.systemConfig.findFirst as jest.Mock).mockReturnValue(query.promise);
  const requests = [warmAppVersionCache(), warmAppVersionCache(), warmAppVersionCache()];
  expect(prisma.systemConfig.findFirst).toHaveBeenCalledTimes(1);
  query.resolve({ appVersion: "2.0" });
  await Promise.all(requests);
  expect(getLoadedAppVersion()).toBe("2.0");
  await warmAppVersionCache();
  expect(prisma.systemConfig.findFirst).toHaveBeenCalledTimes(1);
});

it("does not let an invalidated in-flight read overwrite the new version", async () => {
  const oldQuery = deferred();
  (prisma.systemConfig.findFirst as jest.Mock).mockReturnValueOnce(oldQuery.promise).mockResolvedValueOnce({ appVersion: "new" });
  const oldRequest = warmAppVersionCache();
  invalidateAppVersionCache();
  await warmAppVersionCache();
  oldQuery.resolve({ appVersion: "old" });
  await oldRequest;
  expect(getLoadedAppVersion()).toBe("new");
});

it("retries after a failed query", async () => {
  (prisma.systemConfig.findFirst as jest.Mock).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ appVersion: "recovered" });
  await warmAppVersionCache();
  expect(getLoadedAppVersion()).toBeNull();
  await warmAppVersionCache();
  expect(getLoadedAppVersion()).toBe("recovered");
});
