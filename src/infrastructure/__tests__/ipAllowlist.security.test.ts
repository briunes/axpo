import {
  configuredAllowedIps,
  getClientIp,
  isIpGateBypassPath,
  isLocalRequest,
  normalizeIp,
} from "../security/ipAllowlist";

describe("IP allowlist", () => {
  test.each([
    ["203.0.113.8", "203.0.113.8"],
    ["203.000.113.008", "203.0.113.8"],
    ["2a09:bac0:1001:272::39f:c6", "2a09:bac0:1001:272::39f:c6"],
    ["2A09:BAC0:1001:0272:0000:0000:039F:00C6", "2a09:bac0:1001:272::39f:c6"],
    ["::ffff:203.0.113.8", "203.0.113.8"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });

  test.each(["", "hello", "999.1.1.1", "2001:db8::xyz"])(
    "rejects invalid address %s",
    (input) => expect(normalizeIp(input)).toBeNull(),
  );

  it("supports comma-separated IPv4 and IPv6 extras", () => {
    const allowed = configuredAllowedIps(
      "198.51.100.10, 2a09:bac0:1001:272::39f:c6, invalid",
    );
    expect(allowed.has("198.51.100.10")).toBe(true);
    expect(allowed.has("2a09:bac0:1001:272::39f:c6")).toBe(true);
    expect(allowed.has("invalid")).toBe(false);
  });

  it("uses Vercel's protected forwarded header on Vercel", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "2a09:bac0:1001:0272::39f:c6",
      "x-forwarded-for": "198.51.100.99",
    });
    expect(getClientIp(headers, true)).toBe("2a09:bac0:1001:272::39f:c6");
  });

  it("does not trust x-forwarded-for as a Vercel fallback", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.99" });
    expect(getClientIp(headers, true)).toBeNull();
  });

  it("bypasses localhost only off Vercel", () => {
    expect(isLocalRequest("localhost", false)).toBe(true);
    expect(isLocalRequest("localhost", true)).toBe(false);
  });

  it("is disabled when no valid addresses are configured", () => {
    expect(configuredAllowedIps(undefined).size).toBe(0);
    expect(configuredAllowedIps("invalid").size).toBe(0);
  });

  it.each(["/access-denied", "/axpo-logo.svg", "/axpo-mark.svg"])(
    "allows the public gate resource %s through the IP filter",
    (pathname) => expect(isIpGateBypassPath(pathname)).toBe(true),
  );

  it.each(["/", "/api/v1/public/version", "/other-logo.svg"])(
    "keeps non-gate resource %s protected",
    (pathname) => expect(isIpGateBypassPath(pathname)).toBe(false),
  );
});
