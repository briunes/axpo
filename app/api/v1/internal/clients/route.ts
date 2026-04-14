import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  agencyId: z.string().min(1).optional(),
  cif: z.string().max(50).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  otherDetails: z.string().max(5000).optional(),
});

/**
 * @swagger
 * /api/v1/internal/clients:
 *   get:
 *     tags: [Clients]
 *     summary: List clients scoped by RBAC
 *     description: List all clients (Admin sees all, Agent sees only their agency's clients)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by client name, CIF, or contact name
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
 *           default: name
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: Clients listed
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
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Client'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *   post:
 *     tags: [Clients]
 *     summary: Create a new client
 *     description: Create a new client (Admin or Agent)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientRequest'
 *     responses:
 *       201:
 *         description: Client created
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
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)),
  );
  const search = searchParams.get("search") ?? undefined;
  const orderBy = searchParams.get("orderBy") ?? "name";
  const sortDir =
    (searchParams.get("sortDir") ?? "asc") === "asc" ? "asc" : "desc";

  const allowedOrderBy: Record<string, true> = {
    name: true,
    createdAt: true,
    updatedAt: true,
  };
  const safeOrderBy = allowedOrderBy[orderBy] ? orderBy : "name";

  const baseWhere =
    auth.role === UserRole.ADMIN
      ? { isDeleted: false }
      : { agencyId: auth.agencyId, isDeleted: false };

  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { cif: { contains: search, mode: "insensitive" as const } },
          { contactName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { ...baseWhere };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { [safeOrderBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  return ResponseHandler.ok({ items: clients, total, page, pageSize }, 200);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

  const body = await request.json();
  const payload = createClientSchema.parse(body);

  const agencyId =
    auth.role === UserRole.ADMIN
      ? (payload.agencyId ?? auth.agencyId)
      : auth.agencyId;

  const client = await prisma.client.create({
    data: {
      agencyId,
      name: payload.name.trim(),
      cif: payload.cif?.trim() || null,
      contactName: payload.contactName?.trim() || null,
      contactEmail: payload.contactEmail?.trim() || null,
      contactPhone: payload.contactPhone?.trim() || null,
      otherDetails: payload.otherDetails?.trim() || null,
    },
  });

  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "CLIENT_CREATED",
    targetType: "CLIENT",
    targetId: client.id,
    metadataJson: { name: client.name },
  });

  return ResponseHandler.ok(client, 201);
});
