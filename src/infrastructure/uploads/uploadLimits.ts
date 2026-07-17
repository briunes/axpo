export const DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 15;

export function normalizeMaxUploadFileSizeMb(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_UPLOAD_FILE_SIZE_MB;
  }

  return Math.max(1, Math.round(parsed));
}

export function uploadSizeMbToBytes(value: unknown): number {
  return normalizeMaxUploadFileSizeMb(value) * 1024 * 1024;
}

export function formatUploadSizeLimit(value: unknown): string {
  return `${normalizeMaxUploadFileSizeMb(value)} MB`;
}
