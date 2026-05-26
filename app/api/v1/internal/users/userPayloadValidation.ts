import { z } from "zod";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";

const FALLBACK_MAX_ACTIVE_DEVICES = 3;

const createUserSchema = z.object({
  agencyId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  fullName: z.string().min(2),
  email: z.string().email(),
  mobilePhone: z.string().min(1),
  commercialPhone: z.string().min(1),
  commercialEmail: z.string().email(),
  otherDetails: z.string().max(5000).optional(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/)
    .optional(),
  pin: z.string().regex(/^\d+$/).optional(),
  maxActiveDevices: z.number().int().min(1).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  mobilePhone: z.string().min(1).optional(),
  commercialPhone: z.string().min(1).optional(),
  commercialEmail: z.string().email().optional(),
  otherDetails: z.string().max(5000).optional(),
  maxActiveDevices: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
  agencyId: z.string().optional(),
  password: z.string().min(12).max(128).optional(),
  currentPassword: z.string().min(1).optional(),
  preferences: z
    .object({
      language: z.string().nullable().optional(),
      dateFormat: z.string().nullable().optional(),
      timeFormat: z.string().nullable().optional(),
      timezone: z.string().nullable().optional(),
      numberFormat: z.string().nullable().optional(),
      itemsPerPage: z.number().int().nullable().optional(),
    })
    .optional(),
});

const withConfiguredMaxDevicesLimit = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  maxAllowedDevices: number,
) =>
  schema.superRefine((value, ctx) => {
    const payload = value as { maxActiveDevices?: number };

    if (
      payload.maxActiveDevices !== undefined &&
      payload.maxActiveDevices > maxAllowedDevices
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: maxAllowedDevices,
        type: "number",
        inclusive: true,
        exact: false,
        message: `Number must be less than or equal to ${maxAllowedDevices}`,
        path: ["maxActiveDevices"],
      });
    }
  });

export async function getConfiguredMaxActiveDevicesLimit(): Promise<number> {
  const systemConfig = await prisma.systemConfig.findFirst({
    select: {
      defaultMaxActiveDevices: true,
    },
  });

  return Math.max(
    1,
    systemConfig?.defaultMaxActiveDevices ?? FALLBACK_MAX_ACTIVE_DEVICES,
  );
}

export async function parseCreateUserPayload(body: unknown) {
  return withConfiguredMaxDevicesLimit(
    createUserSchema,
    await getConfiguredMaxActiveDevicesLimit(),
  ).parse(body);
}

export async function parseUpdateUserPayload(body: unknown) {
  return withConfiguredMaxDevicesLimit(
    updateUserSchema,
    await getConfiguredMaxActiveDevicesLimit(),
  ).parse(body);
}
