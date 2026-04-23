import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

const updateAgencySchema = z.object({
  name: z.string().min(2).optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean().optional(),
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

    if (auth.role !== UserRole.ADMIN && auth.agencyId !== id) {
      throw new NotFoundError("Agency", id);
    }

    const agency = await prisma.agency.findUnique({ where: { id } });
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
    assertRole(auth, [UserRole.ADMIN]);

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

    const updated = await prisma.agency.update({
      where: { id },
      data: {
        name: payload.name,
        street: payload.street,
        city: payload.city,
        postalCode: payload.postalCode,
        province: payload.province,
        country: payload.country,
        isActive: payload.isActive,
      },
    });

    const changedKeys = Object.keys(payload) as (keyof typeof payload)[];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of changedKeys) {
      before[key] = (existing as Record<string, unknown>)[key] ?? null;
      after[key] = (updated as Record<string, unknown>)[key] ?? null;
    }
    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "AGENCY_UPDATED",
      targetType: "AGENCY",
      targetId: updated.id,
      metadataJson: changedKeys.length > 0 ? { before, after } : undefined,
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
    assertRole(auth, [UserRole.ADMIN]);

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
