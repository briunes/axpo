import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertRole,
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { AuditService } from "@/application/services/auditService";

const updateAgencySchema = z.object({
  name: z.string().min(2).optional(),
  isTlv: z.boolean().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean().optional(),
  tariffs: z
    .array(
      z.object({
        tariffType: z.string().min(1),
        isEnabled: z.boolean(),
      }),
    )
    .optional(),
  products: z
    .array(
      z.object({
        productKey: z.string().min(1),
        commodity: z.enum(["ELECTRICITY", "GAS"]),
        pricingType: z.enum(["FIXED", "INDEXED"]),
        isEnabled: z.boolean(),
      }),
    )
    .optional(),
});

/**
 * @swagger
 * /api/v1/internal/agencies/{id}:
 *   get:
 *     tags: [Agencies]
 *     summary: Get agency by id
 *     description: Get a specific agency by id (Admin sees any, others only their own)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Agency ID
 *     responses:
 *       200:
 *         description: Agency found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Agency'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Agency not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     tags: [Agencies]
 *     summary: Update agency by id (Admin only)
 *     description: Update an agency (Admin role required)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Agency ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               province:
 *                 type: string
 *               country:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agency updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Agency'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Agency not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Agency id parameter is required");
    }

    if (!isElevatedRole(auth.role) && auth.agencyId !== id) {
      throw new NotFoundError("Agency", id);
    }

    const agency = await prisma.agency.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
    if (!agency || agency.isDeleted) {
      throw new NotFoundError("Agency", id);
    }

    return ResponseHandler.ok(agency, 200);
  },
);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "agencies.edit");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Agency id parameter is required");
    }

    const body = await request.json();
    const payload = updateAgencySchema.parse(body);

    const existing = await prisma.agency.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      throw new NotFoundError("Agency", id);
    }

    const existingTariffs = payload.tariffs
      ? await prisma.agencyTariff.findMany({
          where: { agencyId: id },
          select: { tariffType: true, isEnabled: true },
        })
      : [];
    const existingProducts = payload.products
      ? await prisma.agencyProductConfig.findMany({
          where: { agencyId: id },
          select: {
            productKey: true,
            commodity: true,
            pricingType: true,
            isEnabled: true,
          },
        })
      : [];

    const updateData = {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.isTlv !== undefined && { isTlv: payload.isTlv }),
      ...(payload.street !== undefined && { street: payload.street }),
      ...(payload.city !== undefined && { city: payload.city }),
      ...(payload.postalCode !== undefined && {
        postalCode: payload.postalCode,
      }),
      ...(payload.province !== undefined && { province: payload.province }),
      ...(payload.country !== undefined && { country: payload.country }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      updatedByUserId: auth.userId,
    };
    const resultInclude = {
      createdByUser: {
        select: { id: true, fullName: true, email: true },
      },
      updatedByUser: {
        select: { id: true, fullName: true, email: true },
      },
    };

    let updated;
    if (isSupabaseApiMode()) {
      await (prisma as any).$rpc("axpo_update_agency", {
        p_agency_id: id,
        p_actor_user_id: auth.userId,
        p_data: updateData,
        p_tariffs: payload.tariffs
          ? payload.tariffs.map((tariff) => ({
              id: crypto.randomUUID(),
              ...tariff,
            }))
          : null,
        p_products: payload.products
          ? payload.products.map((product) => ({
              id: crypto.randomUUID(),
              ...product,
            }))
          : null,
        p_now: new Date(),
      });
      updated = await prisma.agency.findUnique({
        where: { id },
        include: resultInclude,
      });
      if (!updated) throw new NotFoundError("Agency", id);
    } else {
      updated = await prisma.$transaction(async (tx) => {
        const updatedAgency = await tx.agency.update({
          where: { id },
          data: updateData,
          include: resultInclude,
        });

        if (payload.tariffs) {
          await Promise.all(
            payload.tariffs.map((tariff) =>
              tx.agencyTariff.upsert({
                where: {
                  agencyId_tariffType: {
                    agencyId: id,
                    tariffType: tariff.tariffType,
                  },
                },
                update: { isEnabled: tariff.isEnabled },
                create: {
                  agencyId: id,
                  tariffType: tariff.tariffType,
                  isEnabled: tariff.isEnabled,
                },
              }),
            ),
          );
        }

        if (payload.products) {
          await Promise.all(
            payload.products.map((product) =>
              tx.agencyProductConfig.upsert({
                where: {
                  agencyId_commodity_pricingType_productKey: {
                    agencyId: id,
                    commodity: product.commodity,
                    pricingType: product.pricingType,
                    productKey: product.productKey,
                  },
                },
                update: { isEnabled: product.isEnabled },
                create: {
                  agencyId: id,
                  productKey: product.productKey,
                  commodity: product.commodity,
                  pricingType: product.pricingType,
                  isEnabled: product.isEnabled,
                },
              }),
            ),
          );
        }

        return updatedAgency;
      });
    }

    const { tariffs, products, ...agencyFields } = payload;
    const changedKeys = Object.keys(
      agencyFields,
    ) as (keyof typeof agencyFields)[];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of changedKeys) {
      before[key] = (existing as Record<string, unknown>)[key] ?? null;
      after[key] = (updated as Record<string, unknown>)[key] ?? null;
    }

    const metadata: Record<string, unknown> = {};
    if (changedKeys.length > 0) {
      metadata.before = before;
      metadata.after = after;
    }
    if (tariffs) {
      metadata.tariffsBefore = existingTariffs;
      metadata.tariffsAfter = tariffs;
    }
    if (products) {
      metadata.productsBefore = existingProducts;
      metadata.productsAfter = products;
    }

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "AGENCY_UPDATED",
      targetType: "AGENCY",
      targetId: updated.id,
      metadataJson: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    return ResponseHandler.ok(updated, 200);
  },
);

/**
 * @swagger
 * /api/v1/internal/agencies/{id}:
 *   delete:
 *     tags: [Agencies]
 *     summary: Delete agency (Admin only - deactivates the agency)
 *     security:
 *       - bearerAuth: []
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "agencies.deactivate");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Agency id parameter is required");
    }

    const existing = await prisma.agency.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      throw new NotFoundError("Agency", id);
    }

    // Admin sets isDeleted = true (soft delete)
    await prisma.agency.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "AGENCY_DELETED",
      targetType: "AGENCY",
      targetId: id,
    });

    return ResponseHandler.ok({ agencyId: id, deleted: true }, 200);
  },
);
