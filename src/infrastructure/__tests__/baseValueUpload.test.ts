import {
  isBaseValueWorkbookFileName,
  isVercelBlobUrl,
} from "@/infrastructure/excel/baseValueUpload";
import { DEFAULT_MAX_UPLOAD_FILE_SIZE_MB } from "@/infrastructure/uploads/uploadLimits";

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

  it("uses 15 MiB as the default configurable upload cap", () => {
    expect(DEFAULT_MAX_UPLOAD_FILE_SIZE_MB).toBe(15);
  });
});
