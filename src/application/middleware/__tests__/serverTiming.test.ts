import { ServerTiming } from "../serverTiming";

const originalEnv = process.env.NODE_ENV;
afterEach(() => { (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv; });

it("adds named local durations while preserving existing timing headers and results", async () => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  const timing = new ServerTiming();
  expect(await timing.measure("read", async () => 42)).toBe(42);
  const headers = new Headers({ "Server-Timing": "earlier;dur=1" });
  timing.append(headers, "total");
  expect(headers.get("Server-Timing")).toMatch(/^earlier;dur=1, read;dur=\d+\.\d, total;dur=\d+\.\d$/);
});

it("does not expose timing headers in production", async () => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  const timing = new ServerTiming();
  await timing.measure("read", async () => null);
  const headers = new Headers();
  timing.append(headers, "total");
  expect(headers.has("Server-Timing")).toBe(false);
});

it("preserves errors from measured operations", async () => {
  const error = new Error("database unavailable");
  await expect(new ServerTiming().measure("read", async () => { throw error; })).rejects.toBe(error);
});
