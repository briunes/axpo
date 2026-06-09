export const MAX_BASE_VALUE_WORKBOOK_SIZE = 50 * 1024 * 1024;

export const BASE_VALUE_WORKBOOK_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/octet-stream",
];

export function isBaseValueWorkbookFileName(fileName: string): boolean {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith(".xlsm") || normalized.endsWith(".xlsx");
}

export function getBaseValueWorkbookContentType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".xlsm")
    ? "application/vnd.ms-excel.sheet.macroEnabled.12"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export function isVercelBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
