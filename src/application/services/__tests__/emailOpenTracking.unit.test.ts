import {
  appendEmailTrackingPixel,
  resolveTrackingBaseUrl,
} from "../emailOpenTracking";

describe("email open tracking", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("inserts the pixel before the closing body tag", () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://mail.example.com/";
    const html = appendEmailTrackingPixel(
      "<html><body>Hello</body></html>",
      "token/value",
    );

    expect(html).toContain(
      'src="https://mail.example.com/api/v1/public/email-open/token%2Fvalue.gif"',
    );
    expect(html).toMatch(/Hello<img[^>]+><\/body><\/html>$/);
  });

  it("appends the pixel to an HTML fragment", () => {
    expect(appendEmailTrackingPixel("<p>Hello</p>", "abc")).toMatch(
      /^<p>Hello<\/p><img[^>]+abc\.gif/,
    );
  });

  it("uses the Vercel deployment URL when no explicit backend URL exists", () => {
    process.env.VERCEL_URL = "deployment.vercel.app";
    expect(resolveTrackingBaseUrl()).toBe("https://deployment.vercel.app");
  });
});
