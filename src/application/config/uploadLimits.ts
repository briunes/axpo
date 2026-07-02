import { prisma } from "@/infrastructure/database/prisma";
import {
  DEFAULT_MAX_UPLOAD_FILE_SIZE_MB,
  normalizeMaxUploadFileSizeMb,
  uploadSizeMbToBytes,
} from "@/infrastructure/uploads/uploadLimits";

export async function getConfiguredMaxUploadFileSizeMb(): Promise<number> {
  const config = await prisma.systemConfig.findFirst({
    select: { maxUploadFileSizeMb: true },
  });

  return normalizeMaxUploadFileSizeMb(
    config?.maxUploadFileSizeMb ?? DEFAULT_MAX_UPLOAD_FILE_SIZE_MB,
  );
}

export async function getConfiguredMaxUploadFileSizeBytes(): Promise<number> {
  return uploadSizeMbToBytes(await getConfiguredMaxUploadFileSizeMb());
}
