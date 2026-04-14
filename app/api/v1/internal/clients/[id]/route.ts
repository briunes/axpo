import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { NotFoundError, ForbiddenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  agencyId: z.string().cuid().optional(),
  cif: z.string().max(50).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  otherDetails: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

/**
 * @swagger
 * /api/v1/internal/clients/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Get client by id
 *     description: Get a specific client (Admin sees any, Agent sees only their agency's clients)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not authorized to access this client
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     tags: [Clients]
 *     summary: Update a client
 *     description: Update client information (Admin or Agent from same agency)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Client ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               agencyId:
 *                 type: string
 *                 format: uuid
 *                 description: Only Admin can change agency
 *               cif:
 *                 type: string
 *                 maxLength: 50
 *               contactName:
 *                 type: string
 *                 maxLength: 200
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *                 maxLength: 50
 *               otherDetails:
 *                 type: string
 *                 maxLength: 5000
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Client updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Client'
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
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Clients]
 *     summary: Soft-delete a client
 *     description: Soft-delete a client (marks as deleted)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Client soft-deleted
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Client not found
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
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

    const id = context?.params?.id;
    if (!id) throw new NotFoundError("Client");

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.isDeleted) {
      throw new NotFoundError("Client", id);
    }

    if (auth.role === UserRole.AGENT && client.agencyId !== auth.agencyId) {
      throw new ForbiddenError("Access denied");
    }

    return ResponseHandler.ok(client, 200);
  },
);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

    const id = context?.params?.id;
    if (!id) throw new NotFoundError("Client");

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.isDeleted) {
      throw new NotFoundError("Client", id);
    }

    // Agents can only edit their own agency's clients
    if (auth.role === UserRole.AGENT && client.agencyId !== auth.agencyId) {
      throw new ForbiddenError("Access denied");
    }

    const body = await request.json();
    const payload = updateClientSchema.parse(body);

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name.trim() }),
        ...(auth.role === UserRole.ADMIN &&
          payload.agencyId !== undefined && { agencyId: payload.agencyId }),
        ...(payload.cif !== undefined && { cif: payload.cif.trim() || null }),
        ...(payload.contactName !== undefined && {
          contactName: payload.contactName.trim() || null,
        }),
        ...(payload.contactEmail !== undefined && {
          contactEmail: payload.contactEmail.trim() || null,
        }),
        ...(payload.contactPhone !== undefined && {
          contactPhone: payload.contactPhone.trim() || null,
        }),
        ...(payload.otherDetails !== undefined && {
          otherDetails: payload.otherDetails.trim() || null,
        }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
    });

    const changedKeys = Object.keys(payload) as (keyof typeof payload)[];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of changedKeys) {
      before[key] = (client as Record<string, unknown>)[key] ?? null;
      after[key] = (updated as Record<string, unknown>)[key] ?? null;
    }
    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "CLIENT_UPDATED",
      targetType: "CLIENT",
      targetId: updated.id,
      metadataJson: changedKeys.length > 0 ? { before, after } : undefined,
    });

    return ResponseHandler.ok(updated, 200);
  },
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

    const id = context?.params?.id;
    if (!id) throw new NotFoundError("Client");

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.isDeleted) {
      throw new NotFoundError("Client", id);
    }

    if (auth.role === UserRole.AGENT && client.agencyId !== auth.agencyId) {
      throw new ForbiddenError("Access denied");
    }

    const deleted = await prisma.client.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "CLIENT_DELETED",
      targetType: "CLIENT",
      targetId: deleted.id,
    });

    return ResponseHandler.ok(deleted, 200);
  },
);
