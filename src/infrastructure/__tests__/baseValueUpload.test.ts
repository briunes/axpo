import {
  isBaseValueWorkbookFileName,
  isVercelBlobUrl,
  MAX_BASE_VALUE_WORKBOOK_SIZE,
} from "@/infrastructure/excel/baseValueUpload";

describe("base value workbook uploads", () => {
  it("accepts supported Excel extensions case-insensitively", () => {
    expect(isBaseValueWorkbookFileName("prices.xlsm")).toBe(true);
    expect(isBaseValueWorkbookFileName("prices.XLSX")).toBe(true);
    expect(isBaseValueWorkbookFileName("prices.csv")).toBe(false);
  });

  it("only accepts HTTPS Vercel Blob URLs", () => {
    expect(
      isVercelBlobUrl(
        "https://store-id.private.blob.vercel-storage.com/base-values/prices.xlsx",
      ),
    ).toBe(true);
    expect(isVercelBlobUrl("https://example.com/prices.xlsx")).toBe(false);
    expect(
      isVercelBlobUrl(
        "https://blob.vercel-storage.com.evil.example/prices.xlsx",
      ),
    ).toBe(false);
    expect(
      isVercelBlobUrl(
        "http://store-id.private.blob.vercel-storage.com/prices.xlsx",
      ),
    ).toBe(false);
  });

  it("caps workbooks at 50 MiB", () => {
    expect(MAX_BASE_VALUE_WORKBOOK_SIZE).toBe(50 * 1024 * 1024);
  });
});
