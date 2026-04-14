import { applyRateLimit } from "../rateLimit";

describe("rate limit security", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(new Date("2026-03-12T10:00:00.000Z"));
  });

  it("allows at least one request", () => {
    expect(() => applyRateLimit("test-key-1")).not.toThrow();
  });

  it("temporarily blocks after too many failed attempts and allows again after window", () => {
    const key = "test-key-blocked";

    for (let i = 0; i < 100; i += 1) {
      expect(() => applyRateLimit(key)).not.toThrow();
    }

    expect(() => applyRateLimit(key)).toThrow("Too many requests");

    // Default window in middleware is 15 minutes.
    jest.setSystemTime(new Date("2026-03-12T10:16:00.000Z"));
    expect(() => applyRateLimit(key)).not.toThrow();
  });
});
